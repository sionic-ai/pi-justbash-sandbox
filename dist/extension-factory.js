import { tmpdir } from "node:os";
import path from "node:path";
import { createHostBinaryBridges } from "./adapters/host-binary-bridge.js";
import { installSandboxLifecycle } from "./lifecycle/install-lifecycle.js";
import { Redactor } from "./security/redactor.js";
import { reapOrphans } from "./session/orphan-reaper.js";
import { SandboxSessionRegistry } from "./session/session-registry.js";
import { registerSandboxTools } from "./tools/register-tools.js";
const FLAG_SANDBOX_ROOT = "sandbox-root";
const FLAG_SANDBOX_FLAT = "sandbox-flat";
const FLAG_MAX_FILE_SIZE_MB = "sandbox-max-file-size-mb";
const FLAG_HOST_BINARIES = "sandbox-host-binaries";
const FLAG_NETWORK_ALLOWED_URLS = "sandbox-network-allowed-urls";
const FLAG_REDACT_ENV = "sandbox-redact-env";
const FLAG_REDACT_MARKER = "sandbox-redaction-marker";
const FLAG_REDACT_ALLOW = "sandbox-redact-env-allow";
const FLAG_REDACT_DENY = "sandbox-redact-env-deny";
const FLAG_REDACT_MIN_LEN = "sandbox-redact-min-length";
const FLAG_HOST_BRIDGE_ENV_ALLOW = "sandbox-host-binary-env-allow";
const DEFAULT_BASE_DIR = path.join(tmpdir(), "pi-justbash");
const ORPHAN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
/**
 * Resolve a configuration value from pi's flag API first, then fall back
 * to environment variables. This dual lookup is necessary because pi's
 * `getFlag()` returns `undefined` in print mode (`-p`) even when the
 * flag was passed on the CLI — a known quirk of pi v0.67.x.
 */
function resolveBaseDir(api) {
    const flag = api.getFlag(FLAG_SANDBOX_ROOT);
    if (typeof flag === "string" && flag.length > 0) {
        return flag;
    }
    const env = process.env.SANDBOX_ROOT;
    if (env !== undefined && env.length > 0) {
        return env;
    }
    return DEFAULT_BASE_DIR;
}
function resolveFlat(api) {
    const flag = api.getFlag(FLAG_SANDBOX_FLAT);
    if (flag === "true" || flag === true) {
        return true;
    }
    const env = process.env.SANDBOX_FLAT;
    return env === "true" || env === "1";
}
function resolveMaxFileReadSize(api) {
    const flag = api.getFlag(FLAG_MAX_FILE_SIZE_MB);
    const raw = typeof flag === "string" && flag.length > 0 ? flag : process.env.SANDBOX_MAX_FILE_SIZE_MB;
    if (raw === undefined || raw.length === 0) {
        return undefined;
    }
    const mb = Number.parseInt(raw, 10);
    if (!Number.isFinite(mb) || mb <= 0) {
        return undefined;
    }
    return mb * 1024 * 1024;
}
function resolveCsv(api, flagName, envName) {
    const flag = api.getFlag(flagName);
    const raw = typeof flag === "string" && flag.length > 0 ? flag : process.env[envName];
    if (raw === undefined || raw.length === 0)
        return [];
    return raw
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name.length > 0);
}
function resolveBooleanFlag(api, flagName, envName, defaultValue) {
    const flag = api.getFlag(flagName);
    if (flag === true || flag === "true" || flag === "1")
        return true;
    if (flag === false || flag === "false" || flag === "0")
        return false;
    const env = process.env[envName];
    if (env === undefined)
        return defaultValue;
    if (env === "false" || env === "0" || env === "no")
        return false;
    if (env === "true" || env === "1" || env === "yes")
        return true;
    return defaultValue;
}
function resolveRedactor(api) {
    const enabled = resolveBooleanFlag(api, FLAG_REDACT_ENV, "SANDBOX_REDACT_ENV", true);
    if (!enabled)
        return Redactor.noop();
    const markerFlag = api.getFlag(FLAG_REDACT_MARKER);
    const marker = typeof markerFlag === "string" && markerFlag.length > 0
        ? markerFlag
        : (process.env.SANDBOX_REDACTION_MARKER ?? "[REDACTED]");
    const allow = resolveCsv(api, FLAG_REDACT_ALLOW, "SANDBOX_REDACT_ENV_ALLOW");
    const deny = resolveCsv(api, FLAG_REDACT_DENY, "SANDBOX_REDACT_ENV_DENY");
    const minLenFlag = api.getFlag(FLAG_REDACT_MIN_LEN);
    const minLenRaw = typeof minLenFlag === "string" && minLenFlag.length > 0
        ? minLenFlag
        : process.env.SANDBOX_REDACT_MIN_LENGTH;
    const minLenParsed = minLenRaw !== undefined ? Number.parseInt(minLenRaw, 10) : Number.NaN;
    const minValueLength = Number.isFinite(minLenParsed) && minLenParsed >= 0 ? minLenParsed : 4;
    return Redactor.fromEnv(process.env, {
        marker,
        minValueLength,
        ...(allow.length > 0 ? { allow } : {}),
        ...(deny.length > 0 ? { deny } : {}),
    });
}
function resolveHostBinaryBridges(api, redactor) {
    const names = resolveCsv(api, FLAG_HOST_BINARIES, "SANDBOX_HOST_BINARIES");
    if (names.length === 0)
        return [];
    const passThrough = resolveCsv(api, FLAG_HOST_BRIDGE_ENV_ALLOW, "SANDBOX_HOST_BINARY_ENV_ALLOW");
    return createHostBinaryBridges({
        names,
        redactor,
        ...(passThrough.length > 0 ? { passThroughSecretEnv: passThrough } : {}),
    });
}
function resolveNetwork(api) {
    const flag = api.getFlag(FLAG_NETWORK_ALLOWED_URLS);
    const raw = typeof flag === "string" && flag.length > 0 ? flag : process.env.SANDBOX_NETWORK_ALLOWED_URLS;
    if (raw === undefined || raw.length === 0) {
        return {};
    }
    const allowedUrlPrefixes = raw
        .split(",")
        .map((url) => url.trim())
        .filter((url) => url.length > 0);
    return allowedUrlPrefixes.length > 0 ? { allowedUrlPrefixes } : {};
}
/**
 * Build a pi-mono `ExtensionFactory` bound to a specific host's tool
 * factories.  Entry files (`entry-pi.ts`, `entry-senpi.ts`) statically
 * import `create{Bash,Read,Write,Edit}ToolDefinition` from **their** host
 * package and pass them here, so this module carries no direct runtime
 * dependency on either host runtime.
 *
 * When loaded, the returned factory:
 *
 * - Registers CLI flags (`--sandbox-root`, `--sandbox-max-file-size-mb`).
 * - Sweeps stale sandbox dirs (best-effort orphan reaper).
 * - Hooks session start/shutdown/fork/switch for per-session sandbox
 *   roots under `$TMPDIR/pi-justbash/sess-<id>-<nonce>`.
 * - Rebinds sandboxed `bash`/`read`/`write`/`edit` tools on every
 *   `session_start` so first-registration-wins consistently shadows the
 *   host-touching defaults.
 * - Installs SIGINT/SIGTERM/SIGHUP handlers that drain the registry.
 */
export function createExtensionFactory(factories) {
    return async function justbashSandboxExtension(api) {
        api.registerFlag(FLAG_SANDBOX_ROOT, {
            type: "string",
            description: "Base directory under which per-session sandbox roots are created. Defaults to $TMPDIR/pi-justbash.",
        });
        api.registerFlag(FLAG_SANDBOX_FLAT, {
            type: "string",
            description: 'When "true", use the sandbox root directory directly instead of creating per-session subdirectories.',
        });
        api.registerFlag(FLAG_MAX_FILE_SIZE_MB, {
            type: "string",
            description: "Override the maximum file read size (MiB) for the sandbox fs.",
        });
        api.registerFlag(FLAG_HOST_BINARIES, {
            type: "string",
            description: "Comma-separated list of host binaries (e.g. `storm,carrier-lint`) to expose inside the sandboxed bash tool.",
        });
        api.registerFlag(FLAG_NETWORK_ALLOWED_URLS, {
            type: "string",
            description: "Comma-separated list of URL prefixes to allow for sandboxed curl/html network access.",
        });
        api.registerFlag(FLAG_REDACT_ENV, {
            type: "string",
            description: 'Enable host env-value redaction in tool output (default "true"). Set to "false" to disable.',
        });
        api.registerFlag(FLAG_REDACT_MARKER, {
            type: "string",
            description: 'Replacement string inserted in place of redacted values. Default "[REDACTED]".',
        });
        api.registerFlag(FLAG_REDACT_ALLOW, {
            type: "string",
            description: "Comma-separated env var names to exempt from redaction (name appears secret but value is known-safe).",
        });
        api.registerFlag(FLAG_REDACT_DENY, {
            type: "string",
            description: "Comma-separated env var names to force-redact regardless of the default heuristic.",
        });
        api.registerFlag(FLAG_REDACT_MIN_LEN, {
            type: "string",
            description: "Minimum value length required for redaction (default 4). Set 0 to always redact.",
        });
        api.registerFlag(FLAG_HOST_BRIDGE_ENV_ALLOW, {
            type: "string",
            description: "Comma-separated env var names allowed to pass through to host binary bridges despite being classified secret.",
        });
        const baseDir = resolveBaseDir(api);
        const flat = resolveFlat(api);
        const maxFileReadSize = resolveMaxFileReadSize(api);
        const redactor = resolveRedactor(api);
        const hostBinaryBridges = resolveHostBinaryBridges(api, redactor);
        const network = resolveNetwork(api);
        // Best-effort startup sweep — skip when flat mode is active because
        // there are no per-session subdirectories to reap.
        if (!flat) {
            reapOrphans({ baseDir, ttlMs: ORPHAN_TTL_MS }).catch(() => { });
        }
        const registry = new SandboxSessionRegistry({ baseDir, flat });
        const lifecycle = installSandboxLifecycle(api, { registry });
        api.on("session_start", async (_event, ctx) => {
            const sessionId = ctx.sessionManager.getSessionId();
            const session = await registry.acquire(sessionId);
            registerSandboxTools(api, {
                session,
                factories,
                network,
                redactor,
                ...(maxFileReadSize !== undefined ? { maxFileReadSize } : {}),
                ...(hostBinaryBridges.length > 0 ? { hostBinaryBridges } : {}),
            });
        });
        installSignalHandlers(() => lifecycle.reapAllSessions());
    };
}
function installSignalHandlers(reap) {
    let reaping = false;
    const handler = async (signal) => {
        if (reaping) {
            return;
        }
        reaping = true;
        try {
            await reap();
        }
        finally {
            // Re-raise default handling so the process actually exits as the
            // user requested once we've cleaned up.
            process.kill(process.pid, signal);
        }
    };
    // We intentionally install these at module level every time the
    // factory runs; listener duplication is cheap and harmless.
    process.once("SIGINT", handler);
    process.once("SIGTERM", handler);
    process.once("SIGHUP", handler);
}
//# sourceMappingURL=extension-factory.js.map
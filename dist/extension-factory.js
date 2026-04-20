import { tmpdir } from "node:os";
import path from "node:path";
import { installSandboxLifecycle } from "./lifecycle/install-lifecycle.js";
import { reapOrphans } from "./session/orphan-reaper.js";
import { SandboxSessionRegistry } from "./session/session-registry.js";
import { buildDisableGrepTool, buildGrepToolCallBlocker } from "./tools/disable-grep.js";
import { registerSandboxTools } from "./tools/register-tools.js";
const FLAG_SANDBOX_ROOT = "sandbox-root";
const FLAG_SANDBOX_FLAT = "sandbox-flat";
const FLAG_MAX_FILE_SIZE_MB = "sandbox-max-file-size-mb";
const DEFAULT_BASE_DIR = path.join(tmpdir(), "pi-justbash");
const ORPHAN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
function resolveBaseDir(api) {
    const flag = api.getFlag(FLAG_SANDBOX_ROOT);
    if (typeof flag === "string" && flag.length > 0) {
        return flag;
    }
    return DEFAULT_BASE_DIR;
}
function resolveFlat(api) {
    const flag = api.getFlag(FLAG_SANDBOX_FLAT);
    return flag === "true" || flag === true;
}
function resolveMaxFileReadSize(api) {
    const flag = api.getFlag(FLAG_MAX_FILE_SIZE_MB);
    if (typeof flag !== "string" || flag.length === 0) {
        return undefined;
    }
    const mb = Number.parseInt(flag, 10);
    if (!Number.isFinite(mb) || mb <= 0) {
        return undefined;
    }
    return mb * 1024 * 1024;
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
 * - Shadows the built-in `grep` tool with a disabled stub.
 * - Blocks any stray `grep` tool calls at the `tool_call` gate.
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
        const baseDir = resolveBaseDir(api);
        const flat = resolveFlat(api);
        const maxFileReadSize = resolveMaxFileReadSize(api);
        // Best-effort startup sweep — skip when flat mode is active because
        // there are no per-session subdirectories to reap.
        if (!flat) {
            reapOrphans({ baseDir, ttlMs: ORPHAN_TTL_MS }).catch(() => { });
        }
        // Stage 1 of the grep defense-in-depth: shadow the built-in grep tool.
        api.registerTool(buildDisableGrepTool());
        // Stage 2: block any lingering grep invocations at the tool_call gate.
        api.on("tool_call", buildGrepToolCallBlocker());
        const registry = new SandboxSessionRegistry({ baseDir, flat });
        const lifecycle = installSandboxLifecycle(api, { registry });
        api.on("session_start", async (_event, ctx) => {
            const sessionId = ctx.sessionManager.getSessionId();
            const session = await registry.acquire(sessionId);
            registerSandboxTools(api, {
                session,
                factories,
                ...(maxFileReadSize !== undefined ? { maxFileReadSize } : {}),
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
import { tmpdir } from "node:os";
import path from "node:path";
import { installSandboxLifecycle } from "./lifecycle/install-lifecycle.js";
import { reapOrphans } from "./session/orphan-reaper.js";
import { SandboxSessionRegistry } from "./session/session-registry.js";
import { buildDisableGrepTool, buildGrepToolCallBlocker } from "./tools/disable-grep.js";
import { registerSandboxTools } from "./tools/register-tools.js";
const FLAG_SANDBOX_ROOT = "sandbox-root";
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
 * pi-mono {@link @mariozechner/pi-coding-agent#ExtensionFactory} entry
 * point for `@sionic-ai/pi-justbash-sandbox`.
 *
 * Load it either by listing this package in `.pi/settings.json` under
 * `packages` / `extensions`, or by embedding it directly:
 *
 * ```ts
 * import { DefaultResourceLoader } from "@mariozechner/pi-coding-agent";
 * import justbashSandbox from "@sionic-ai/pi-justbash-sandbox";
 *
 * const resourceLoader = new DefaultResourceLoader({
 *   extensionFactories: [justbashSandbox],
 * });
 * ```
 *
 * On load it:
 * - Registers CLI flags (`--sandbox-root`, `--sandbox-max-file-size-mb`).
 * - Runs the orphan reaper once so stale sandbox dirs from previous
 *   runs are cleaned up best-effort.
 * - Registers a grep replacement tool + a tool_call blocker so any
 *   grep invocation short-circuits with a sandbox notice.
 * - Installs the session lifecycle hooks that create / tear down a
 *   per-pi-session sandbox root.
 * - On every `session_start`, registers (and thereby re-binds) the
 *   sandboxed bash/read/write/edit tools against the current session's
 *   root so pi-mono's first-registration-wins rule shadows the host-
 *   touching defaults.
 * - Installs process signal handlers (SIGINT/SIGTERM/SIGHUP) that drain
 *   the session registry before the process exits.
 */
export default async function createJustBashExtension(api) {
    api.registerFlag(FLAG_SANDBOX_ROOT, {
        type: "string",
        description: "Base directory under which per-session sandbox roots are created. Defaults to $TMPDIR/pi-justbash.",
    });
    api.registerFlag(FLAG_MAX_FILE_SIZE_MB, {
        type: "string",
        description: "Override the maximum file read size (MiB) for the sandbox fs.",
    });
    const baseDir = resolveBaseDir(api);
    const maxFileReadSize = resolveMaxFileReadSize(api);
    // Best-effort startup sweep. Swallow errors so a locked/missing dir
    // cannot prevent the extension from loading.
    reapOrphans({ baseDir, ttlMs: ORPHAN_TTL_MS }).catch(() => { });
    // Stage 1 of the grep defense-in-depth: shadow the built-in grep tool.
    api.registerTool(buildDisableGrepTool());
    // Stage 2: block any lingering grep invocations at the tool_call gate.
    api.on("tool_call", buildGrepToolCallBlocker());
    const registry = new SandboxSessionRegistry({ baseDir });
    const lifecycle = installSandboxLifecycle(api, { registry });
    api.on("session_start", async (_event, ctx) => {
        const sessionId = ctx.sessionManager.getSessionId();
        const session = await registry.acquire(sessionId);
        registerSandboxTools(api, {
            session,
            ...(maxFileReadSize !== undefined ? { maxFileReadSize } : {}),
        });
    });
    installSignalHandlers(() => lifecycle.reapAllSessions());
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
//# sourceMappingURL=index.js.map
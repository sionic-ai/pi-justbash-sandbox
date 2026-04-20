import { tmpdir } from "node:os";
import path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { installSandboxLifecycle } from "./lifecycle/install-lifecycle.js";
import { reapOrphans } from "./session/orphan-reaper.js";
import { SandboxSessionRegistry } from "./session/session-registry.js";
import { buildDisableGrepTool, buildGrepToolCallBlocker } from "./tools/disable-grep.js";
import { registerSandboxTools } from "./tools/register-tools.js";
import type { ToolFactories } from "./tools/tool-factories.js";

const FLAG_SANDBOX_ROOT = "sandbox-root";
const FLAG_SANDBOX_FLAT = "sandbox-flat";
const FLAG_MAX_FILE_SIZE_MB = "sandbox-max-file-size-mb";

const DEFAULT_BASE_DIR = path.join(tmpdir(), "pi-justbash");
const ORPHAN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * Resolve a configuration value from pi's flag API first, then fall back
 * to environment variables. This dual lookup is necessary because pi's
 * `getFlag()` returns `undefined` in print mode (`-p`) even when the
 * flag was passed on the CLI — a known quirk of pi v0.67.x.
 */
function resolveBaseDir(api: ExtensionAPI): string {
  const flag = api.getFlag(FLAG_SANDBOX_ROOT);
  if (typeof flag === "string" && flag.length > 0) {
    return flag;
  }
  const env = process.env["SANDBOX_ROOT"];
  if (env !== undefined && env.length > 0) {
    return env;
  }
  return DEFAULT_BASE_DIR;
}

function resolveFlat(api: ExtensionAPI): boolean {
  const flag = api.getFlag(FLAG_SANDBOX_FLAT);
  if (flag === "true" || flag === true) {
    return true;
  }
  const env = process.env["SANDBOX_FLAT"];
  return env === "true" || env === "1";
}

function resolveMaxFileReadSize(api: ExtensionAPI): number | undefined {
  const flag = api.getFlag(FLAG_MAX_FILE_SIZE_MB);
  const raw = typeof flag === "string" && flag.length > 0
    ? flag
    : process.env["SANDBOX_MAX_FILE_SIZE_MB"];
  if (raw === undefined || raw.length === 0) {
    return undefined;
  }
  const mb = Number.parseInt(raw, 10);
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
export function createExtensionFactory(
  factories: ToolFactories,
): (api: ExtensionAPI) => Promise<void> {
  return async function justbashSandboxExtension(api: ExtensionAPI): Promise<void> {
    api.registerFlag(FLAG_SANDBOX_ROOT, {
      type: "string",
      description:
        "Base directory under which per-session sandbox roots are created. Defaults to $TMPDIR/pi-justbash.",
    });
    api.registerFlag(FLAG_SANDBOX_FLAT, {
      type: "string",
      description:
        'When "true", use the sandbox root directory directly instead of creating per-session subdirectories.',
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
      reapOrphans({ baseDir, ttlMs: ORPHAN_TTL_MS }).catch(() => {});
    }

    // Stage 1 of the grep defense-in-depth: shadow the built-in grep tool.
    api.registerTool(buildDisableGrepTool());
    // Stage 2: block any lingering grep invocations at the tool_call gate.
    api.on("tool_call", buildGrepToolCallBlocker());

    const registry = new SandboxSessionRegistry({ baseDir, flat });
    const lifecycle = installSandboxLifecycle(api, { registry });

    api.on("session_start", async (_event, ctx: ExtensionContext) => {
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

function installSignalHandlers(reap: () => Promise<void>): void {
  let reaping = false;
  const handler = async (signal: NodeJS.Signals) => {
    if (reaping) {
      return;
    }
    reaping = true;
    try {
      await reap();
    } finally {
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

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { ToolFactories } from "./tools/tool-factories.js";
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
export declare function createExtensionFactory(factories: ToolFactories): (api: ExtensionAPI) => Promise<void>;
//# sourceMappingURL=extension-factory.d.ts.map
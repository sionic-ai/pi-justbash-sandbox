import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
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
export default function createJustBashExtension(api: ExtensionAPI): Promise<void>;
//# sourceMappingURL=index.d.ts.map
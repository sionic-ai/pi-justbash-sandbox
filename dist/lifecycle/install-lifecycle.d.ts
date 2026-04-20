import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { SandboxSessionRegistry } from "../session/session-registry.js";
/**
 * Options for {@link installSandboxLifecycle}.
 */
export interface InstallSandboxLifecycleOptions {
    /** Registry that owns every {@link SandboxSession} for this process. */
    readonly registry: SandboxSessionRegistry;
}
/**
 * Return value from {@link installSandboxLifecycle}. Exposes a hook
 * callers can trigger from signal handlers to drain the registry.
 */
export interface SandboxLifecycleHandle {
    /** Clean every registered sandbox. Intended for process shutdown paths. */
    reapAllSessions(): Promise<void>;
}
/**
 * Subscribe the sandbox registry to pi-mono's session lifecycle events
 * on the supplied {@link ExtensionAPI}:
 * - `session_start` acquires (and thereby ensures) the session's root.
 * - `session_shutdown` releases it.
 * - `session_before_switch` releases the outgoing session's root before
 *   pi swaps to another session.
 * - `session_before_fork` releases the current session's root so the
 *   forked session starts from a clean sandbox.
 *
 * Returns a handle whose {@link SandboxLifecycleHandle.reapAllSessions}
 * drains the registry in parallel; wire that into SIGINT/SIGTERM/SIGHUP
 * handlers at the extension entry point.
 */
export declare function installSandboxLifecycle(api: ExtensionAPI, options: InstallSandboxLifecycleOptions): SandboxLifecycleHandle;
//# sourceMappingURL=install-lifecycle.d.ts.map
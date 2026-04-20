import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
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
export function installSandboxLifecycle(
  api: ExtensionAPI,
  options: InstallSandboxLifecycleOptions,
): SandboxLifecycleHandle {
  const { registry } = options;

  api.on("session_start", async (_event, ctx: ExtensionContext) => {
    const sessionId = ctx.sessionManager.getSessionId();
    await registry.acquire(sessionId);
  });

  api.on("session_shutdown", async (_event, ctx: ExtensionContext) => {
    const sessionId = ctx.sessionManager.getSessionId();
    await registry.release(sessionId);
  });

  api.on("session_before_switch", async (_event, ctx: ExtensionContext) => {
    const sessionId = ctx.sessionManager.getSessionId();
    await registry.release(sessionId);
    return undefined;
  });

  api.on("session_before_fork", async (_event, ctx: ExtensionContext) => {
    const sessionId = ctx.sessionManager.getSessionId();
    await registry.release(sessionId);
    return undefined;
  });

  return {
    reapAllSessions: () => registry.releaseAll(),
  };
}

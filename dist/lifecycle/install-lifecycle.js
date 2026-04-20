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
export function installSandboxLifecycle(api, options) {
    const { registry } = options;
    api.on("session_start", async (_event, ctx) => {
        const sessionId = ctx.sessionManager.getSessionId();
        await registry.acquire(sessionId);
    });
    api.on("session_shutdown", async (_event, ctx) => {
        const sessionId = ctx.sessionManager.getSessionId();
        await registry.release(sessionId);
    });
    api.on("session_before_switch", async (_event, ctx) => {
        const sessionId = ctx.sessionManager.getSessionId();
        await registry.release(sessionId);
        return undefined;
    });
    api.on("session_before_fork", async (_event, ctx) => {
        const sessionId = ctx.sessionManager.getSessionId();
        await registry.release(sessionId);
        return undefined;
    });
    return {
        reapAllSessions: () => registry.releaseAll(),
    };
}
//# sourceMappingURL=install-lifecycle.js.map
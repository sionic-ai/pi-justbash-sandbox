import { SandboxSession } from "./sandbox-session.js";
/**
 * Construction parameters for {@link SandboxSessionRegistry}.
 */
export interface SandboxSessionRegistryOptions {
    /** Base directory shared by every {@link SandboxSession} in this registry. */
    readonly baseDir: string;
}
/**
 * Maps a pi-mono session id to the {@link SandboxSession} that owns its
 * isolated root. Extensions interact with this registry instead of
 * constructing SandboxSessions directly: {@link acquire} is idempotent and
 * ensure()s on first access, {@link release} + {@link releaseAll} clean up
 * on session lifecycle events (shutdown, switch, SIGINT, ...).
 */
export declare class SandboxSessionRegistry {
    #private;
    constructor(options: SandboxSessionRegistryOptions);
    /**
     * Return the {@link SandboxSession} for `sessionId`, constructing and
     * ensuring a fresh one on first access. Subsequent calls with the same
     * id return the cached instance (so its root path is stable across a pi
     * session).
     */
    acquire(sessionId: string): Promise<SandboxSession>;
    /**
     * Whether the registry currently tracks a session for `sessionId`.
     */
    has(sessionId: string): boolean;
    /**
     * Count of currently tracked sessions.
     */
    size(): number;
    /**
     * Clean up the session for `sessionId` and remove it from the registry.
     * No-op if the id is unknown.
     */
    release(sessionId: string): Promise<void>;
    /**
     * Clean up every tracked session. Safe to call on process shutdown; we
     * wait for all cleanups to settle before returning.
     */
    releaseAll(): Promise<void>;
}
//# sourceMappingURL=session-registry.d.ts.map
/**
 * Construction parameters for {@link SandboxSession}.
 */
export interface SandboxSessionOptions {
    /** Absolute base directory that owns every sandbox root. */
    readonly baseDir: string;
    /**
     * pi-mono session id — appears as-is in the sandbox directory name.
     * Must be a non-empty single path segment; path separators and relative
     * traversal (`..`) are rejected to prevent sandbox-escape.
     */
    readonly sessionId: string;
    /**
     * Override the random suffix (hex). Intended only for tests that need
     * deterministic paths. Production code should omit this.
     */
    readonly suffix?: string;
}
/**
 * One sandbox per pi session. Owns a lazily-created root directory under
 * `baseDir` and knows how to tear it down. The root is guaranteed to be
 * unique per {@link SandboxSession} instance (random suffix) so concurrent
 * test runs and stale state cannot collide.
 */
export declare class SandboxSession {
    #private;
    constructor(options: SandboxSessionOptions);
    /**
     * Create the sandbox root if it does not exist yet. Idempotent: repeated
     * calls return the same absolute path for the lifetime of the instance.
     */
    ensure(): Promise<string>;
    /**
     * Return the ensured root path. Throws if {@link ensure} has not been
     * called yet — callers should treat "no root" as a programmer error.
     */
    getRoot(): string;
    /**
     * Delete the sandbox root, if one exists. Best-effort: if the directory
     * was already removed out-of-band we silently succeed. Concurrent callers
     * share a single in-flight cleanup promise so we never double-rm.
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=sandbox-session.d.ts.map
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
export class SandboxSessionRegistry {
  readonly #baseDir: string;
  readonly #sessions = new Map<string, SandboxSession>();

  constructor(options: SandboxSessionRegistryOptions) {
    this.#baseDir = options.baseDir;
  }

  /**
   * Return the {@link SandboxSession} for `sessionId`, constructing and
   * ensuring a fresh one on first access. Subsequent calls with the same
   * id return the cached instance (so its root path is stable across a pi
   * session).
   */
  async acquire(sessionId: string): Promise<SandboxSession> {
    const cached = this.#sessions.get(sessionId);
    if (cached !== undefined) {
      return cached;
    }
    const session = new SandboxSession({ baseDir: this.#baseDir, sessionId });
    await session.ensure();
    this.#sessions.set(sessionId, session);
    return session;
  }

  /**
   * Whether the registry currently tracks a session for `sessionId`.
   */
  has(sessionId: string): boolean {
    return this.#sessions.has(sessionId);
  }

  /**
   * Count of currently tracked sessions.
   */
  size(): number {
    return this.#sessions.size;
  }

  /**
   * Clean up the session for `sessionId` and remove it from the registry.
   * No-op if the id is unknown.
   */
  async release(sessionId: string): Promise<void> {
    const session = this.#sessions.get(sessionId);
    if (session === undefined) {
      return;
    }
    this.#sessions.delete(sessionId);
    await session.cleanup();
  }

  /**
   * Clean up every tracked session. Safe to call on process shutdown; we
   * wait for all cleanups to settle before returning.
   */
  async releaseAll(): Promise<void> {
    const sessions = Array.from(this.#sessions.values());
    this.#sessions.clear();
    await Promise.all(sessions.map((session) => session.cleanup()));
  }
}

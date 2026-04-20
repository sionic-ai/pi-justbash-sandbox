import { randomBytes } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

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

const SUFFIX_BYTES = 8;

function hexSuffix(): string {
  return randomBytes(SUFFIX_BYTES).toString("hex");
}

function assertValidSessionId(sessionId: string): void {
  if (sessionId.length === 0) {
    throw new Error("SandboxSession: sessionId must be non-empty");
  }
  if (sessionId.includes("/") || sessionId.includes("\\")) {
    throw new Error(
      `SandboxSession: sessionId must not contain path separators (got ${JSON.stringify(sessionId)})`,
    );
  }
  if (sessionId === "." || sessionId === ".." || sessionId.includes("\0")) {
    throw new Error(
      `SandboxSession: sessionId must not be a relative traversal (got ${JSON.stringify(sessionId)})`,
    );
  }
}

/**
 * One sandbox per pi session. Owns a lazily-created root directory under
 * `baseDir` and knows how to tear it down. The root is guaranteed to be
 * unique per {@link SandboxSession} instance (random suffix) so concurrent
 * test runs and stale state cannot collide.
 */
export class SandboxSession {
  readonly #baseDir: string;
  readonly #sessionId: string;
  readonly #suffix: string;
  #root: string | undefined;
  #cleanupInFlight: Promise<void> | undefined;

  constructor(options: SandboxSessionOptions) {
    assertValidSessionId(options.sessionId);
    this.#baseDir = options.baseDir;
    this.#sessionId = options.sessionId;
    this.#suffix = options.suffix ?? hexSuffix();
  }

  /**
   * Create the sandbox root if it does not exist yet. Idempotent: repeated
   * calls return the same absolute path for the lifetime of the instance.
   */
  async ensure(): Promise<string> {
    if (this.#root !== undefined) {
      return this.#root;
    }
    const root = path.join(this.#baseDir, `sess-${this.#sessionId}-${this.#suffix}`);
    await mkdir(root, { recursive: true, mode: 0o700 });
    this.#root = root;
    return root;
  }

  /**
   * Return the ensured root path. Throws if {@link ensure} has not been
   * called yet — callers should treat "no root" as a programmer error.
   */
  getRoot(): string {
    if (this.#root === undefined) {
      throw new Error("SandboxSession is not ensured yet; call ensure() first");
    }
    return this.#root;
  }

  /**
   * Delete the sandbox root, if one exists. Best-effort: if the directory
   * was already removed out-of-band we silently succeed. Concurrent callers
   * share a single in-flight cleanup promise so we never double-rm.
   */
  async cleanup(): Promise<void> {
    if (this.#cleanupInFlight !== undefined) {
      return this.#cleanupInFlight;
    }
    const root = this.#root;
    if (root === undefined) {
      return;
    }
    this.#cleanupInFlight = (async () => {
      try {
        await rm(root, { recursive: true, force: true, maxRetries: 3 });
      } finally {
        this.#root = undefined;
        this.#cleanupInFlight = undefined;
      }
    })();
    return this.#cleanupInFlight;
  }
}

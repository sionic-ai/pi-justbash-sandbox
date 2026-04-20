import { randomBytes } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

/**
 * Construction parameters for {@link SandboxSession}.
 */
export interface SandboxSessionOptions {
  /** Absolute base directory that owns every sandbox root. */
  readonly baseDir: string;
  /** pi-mono session id — appears as-is in the sandbox directory name. */
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

  constructor(options: SandboxSessionOptions) {
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
   * was already removed out-of-band we silently succeed. After cleanup the
   * session goes back to the pre-ensure state and can be re-ensured.
   */
  async cleanup(): Promise<void> {
    const root = this.#root;
    if (root === undefined) {
      return;
    }
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
    this.#root = undefined;
  }
}

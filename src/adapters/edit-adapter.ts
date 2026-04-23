import path from "node:path";
import type { EditOperations } from "@mariozechner/pi-coding-agent";
import type { IFileSystem } from "just-bash";
import { looksText } from "../fs/detect-content-type.js";
import { toVirtualPath } from "../fs/sandbox-paths.js";
import { Redactor } from "../security/redactor.js";

/**
 * Construction parameters for {@link EditAdapter}.
 */
export interface EditAdapterOptions {
  /** The sandbox filesystem (`ReadWriteFs({ root, allowSymlinks: false })`). */
  readonly fs: IFileSystem;
  /** Host-absolute sandbox root. */
  readonly root: string;
  /**
   * Redactor applied to both `readFile` and `writeFile`. On read, the
   * original bytes are returned untouched when the content looks binary
   * so the round-trip cannot corrupt them. Defaults to
   * {@link Redactor.noop}.
   */
  readonly redactor?: Redactor;
}

/**
 * pi-mono {@link EditOperations} implementation. The edit tool drives a
 * read → mutate → write flow and expects all three operations to observe
 * the same fs. By delegating every step to the sandbox `ReadWriteFs`, the
 * diff pi computes is guaranteed to apply to the exact bytes that the
 * read returned.
 */
export class EditAdapter implements EditOperations {
  readonly #fs: IFileSystem;
  readonly #root: string;
  readonly #redactor: Redactor;

  constructor(options: EditAdapterOptions) {
    this.#fs = options.fs;
    this.#root = options.root;
    this.#redactor = options.redactor ?? Redactor.noop();
  }

  async readFile(absolutePath: string): Promise<Buffer> {
    const virtualPath = toVirtualPath(this.#root, absolutePath);
    const bytes = await this.#fs.readFileBuffer(virtualPath);
    const raw = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (this.#redactor.isNoop() || !looksText(bytes)) {
      return raw;
    }
    return this.#redactor.redactBuffer(raw);
  }

  async writeFile(absolutePath: string, content: string): Promise<void> {
    const virtualPath = toVirtualPath(this.#root, absolutePath);
    const parent = path.posix.dirname(virtualPath);
    if (parent !== "" && parent !== "/" && parent !== ".") {
      await this.#fs.mkdir(parent, { recursive: true });
    }
    const redacted = this.#redactor.isNoop() ? content : this.#redactor.redact(content);
    await this.#fs.writeFile(virtualPath, redacted);
  }

  async access(absolutePath: string): Promise<void> {
    const virtualPath = toVirtualPath(this.#root, absolutePath);
    const exists = await this.#fs.exists(virtualPath);
    if (!exists) {
      const err = new Error(`ENOENT: no such file or directory, ${absolutePath}`) as Error & {
        code?: string;
      };
      err.code = "ENOENT";
      throw err;
    }
  }
}

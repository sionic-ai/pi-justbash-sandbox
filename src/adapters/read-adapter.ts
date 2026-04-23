import type { ReadOperations } from "@mariozechner/pi-coding-agent";
import type { IFileSystem } from "just-bash";
import { detectImageMagic, looksBinary } from "../fs/detect-content-type.js";
import { toVirtualPath } from "../fs/sandbox-paths.js";
import { Redactor } from "../security/redactor.js";

/**
 * Construction parameters for {@link ReadAdapter}.
 */
export interface ReadAdapterOptions {
  /** The sandbox filesystem (`ReadWriteFs({ root, allowSymlinks: false })`). */
  readonly fs: IFileSystem;
  /** Host-absolute sandbox root. */
  readonly root: string;
  /**
   * Redactor applied to text file content before it is returned to pi.
   * Skipped for files whose magic bytes identify them as binary (image
   * formats) so raw bytes are preserved for MIME detection and image
   * attachments. Defaults to {@link Redactor.noop}.
   */
  readonly redactor?: Redactor;
}

/**
 * pi-mono {@link ReadOperations} implementation that delegates to the
 * sandbox `ReadWriteFs`. Host-absolute paths from pi are translated to
 * virtual paths before hitting the fs gate so the sandbox's built-in
 * symlink + TOCTOU protection keeps working. Paths that escape the
 * sandbox reject with the underlying fs error.
 */
export class ReadAdapter implements ReadOperations {
  readonly #fs: IFileSystem;
  readonly #root: string;
  readonly #redactor: Redactor;

  constructor(options: ReadAdapterOptions) {
    this.#fs = options.fs;
    this.#root = options.root;
    this.#redactor = options.redactor ?? Redactor.noop();
  }

  async readFile(absolutePath: string): Promise<Buffer> {
    const virtualPath = toVirtualPath(this.#root, absolutePath);
    const bytes = await this.#fs.readFileBuffer(virtualPath);
    const raw = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (this.#redactor.isNoop() || looksBinary(bytes)) {
      return raw;
    }
    return this.#redactor.redactBuffer(raw);
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

  async detectImageMimeType(absolutePath: string): Promise<string | null> {
    const virtualPath = toVirtualPath(this.#root, absolutePath);
    const bytes = await this.#fs.readFileBuffer(virtualPath);
    return detectImageMagic(bytes);
  }
}

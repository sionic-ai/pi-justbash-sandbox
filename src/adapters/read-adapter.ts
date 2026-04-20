import type { ReadOperations } from "@mariozechner/pi-coding-agent";
import type { IFileSystem } from "just-bash";
import { toVirtualPath } from "../fs/sandbox-paths.js";

/**
 * Construction parameters for {@link ReadAdapter}.
 */
export interface ReadAdapterOptions {
  /** The sandbox filesystem (`ReadWriteFs({ root, allowSymlinks: false })`). */
  readonly fs: IFileSystem;
  /** Host-absolute sandbox root. */
  readonly root: string;
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

  constructor(options: ReadAdapterOptions) {
    this.#fs = options.fs;
    this.#root = options.root;
  }

  async readFile(absolutePath: string): Promise<Buffer> {
    const virtualPath = toVirtualPath(this.#root, absolutePath);
    const bytes = await this.#fs.readFileBuffer(virtualPath);
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
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

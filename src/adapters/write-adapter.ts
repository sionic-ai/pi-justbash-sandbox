import path from "node:path";
import type { WriteOperations } from "@mariozechner/pi-coding-agent";
import type { IFileSystem } from "just-bash";
import { toVirtualPath } from "../fs/sandbox-paths.js";

/**
 * Construction parameters for {@link WriteAdapter}.
 */
export interface WriteAdapterOptions {
  /** The sandbox filesystem (`ReadWriteFs({ root, allowSymlinks: false })`). */
  readonly fs: IFileSystem;
  /** Host-absolute sandbox root. */
  readonly root: string;
}

/**
 * pi-mono {@link WriteOperations} implementation that writes through the
 * sandbox `ReadWriteFs`. `writeFile()` auto-creates missing parent
 * directories so callers don't have to pair every write with an explicit
 * mkdir; `mkdir()` is exposed so pi tools that do an explicit mkdir still
 * route through the sandbox gate.
 */
export class WriteAdapter implements WriteOperations {
  readonly #fs: IFileSystem;
  readonly #root: string;

  constructor(options: WriteAdapterOptions) {
    this.#fs = options.fs;
    this.#root = options.root;
  }

  async writeFile(absolutePath: string, content: string): Promise<void> {
    const virtualPath = toVirtualPath(this.#root, absolutePath);
    const parent = path.posix.dirname(virtualPath);
    if (parent !== "" && parent !== "/" && parent !== ".") {
      await this.#fs.mkdir(parent, { recursive: true });
    }
    await this.#fs.writeFile(virtualPath, content);
  }

  async mkdir(dir: string): Promise<void> {
    const virtualPath = toVirtualPath(this.#root, dir);
    await this.#fs.mkdir(virtualPath, { recursive: true });
  }
}

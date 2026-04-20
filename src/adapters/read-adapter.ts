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

  async detectImageMimeType(absolutePath: string): Promise<string | null> {
    const virtualPath = toVirtualPath(this.#root, absolutePath);
    const bytes = await this.#fs.readFileBuffer(virtualPath);
    return detectImageMagic(bytes);
  }
}

function detectImageMagic(bytes: Uint8Array): string | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // GIF: "GIF87a" or "GIF89a"
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

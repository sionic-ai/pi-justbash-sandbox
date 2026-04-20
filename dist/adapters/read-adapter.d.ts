import type { ReadOperations } from "@mariozechner/pi-coding-agent";
import type { IFileSystem } from "just-bash";
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
export declare class ReadAdapter implements ReadOperations {
    #private;
    constructor(options: ReadAdapterOptions);
    readFile(absolutePath: string): Promise<Buffer>;
    access(absolutePath: string): Promise<void>;
    detectImageMimeType(absolutePath: string): Promise<string | null>;
}
//# sourceMappingURL=read-adapter.d.ts.map
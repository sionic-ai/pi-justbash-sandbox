import type { WriteOperations } from "@mariozechner/pi-coding-agent";
import type { IFileSystem } from "just-bash";
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
export declare class WriteAdapter implements WriteOperations {
    #private;
    constructor(options: WriteAdapterOptions);
    writeFile(absolutePath: string, content: string): Promise<void>;
    mkdir(dir: string): Promise<void>;
}
//# sourceMappingURL=write-adapter.d.ts.map
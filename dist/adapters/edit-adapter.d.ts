import type { EditOperations } from "@mariozechner/pi-coding-agent";
import type { IFileSystem } from "just-bash";
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
export declare class EditAdapter implements EditOperations {
    #private;
    constructor(options: EditAdapterOptions);
    readFile(absolutePath: string): Promise<Buffer>;
    writeFile(absolutePath: string, content: string): Promise<void>;
    access(absolutePath: string): Promise<void>;
}
//# sourceMappingURL=edit-adapter.d.ts.map
import { ReadWriteFs } from "just-bash";
/**
 * Options for {@link createSandboxFs}.
 */
export interface CreateSandboxFsOptions {
    /** Absolute path to the sandbox root. */
    readonly root: string;
    /**
     * Maximum file size (bytes) for read operations. Defaults to 10 MiB —
     * the same default ReadWriteFs ships with.
     */
    readonly maxFileReadSize?: number;
}
/**
 * Build the sandbox filesystem used by every adapter. Always constructs
 * `ReadWriteFs` with `allowSymlinks: false` to inherit the upstream
 * symlink + TOCTOU defences; callers cannot opt out.
 */
export declare function createSandboxFs(options: CreateSandboxFsOptions): ReadWriteFs;
//# sourceMappingURL=create-sandbox-fs.d.ts.map
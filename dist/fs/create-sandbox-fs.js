import { ReadWriteFs } from "just-bash";
const DEFAULT_MAX_FILE_READ_SIZE = 10 * 1024 * 1024;
/**
 * Build the sandbox filesystem used by every adapter. Always constructs
 * `ReadWriteFs` with `allowSymlinks: false` to inherit the upstream
 * symlink + TOCTOU defences; callers cannot opt out.
 */
export function createSandboxFs(options) {
    const opts = {
        root: options.root,
        allowSymlinks: false,
        maxFileReadSize: options.maxFileReadSize ?? DEFAULT_MAX_FILE_READ_SIZE,
    };
    return new ReadWriteFs(opts);
}
//# sourceMappingURL=create-sandbox-fs.js.map
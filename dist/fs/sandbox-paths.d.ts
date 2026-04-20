/**
 * Translate a host-absolute path into the virtual path that ReadWriteFs
 * expects. ReadWriteFs mounts the sandbox root at the virtual `/`, so a
 * host path of `<root>/sub/dir` maps to `/sub/dir`.
 *
 * @param root   Host-absolute sandbox root (must already be realpath-normalised).
 * @param target Host-absolute path that should live inside `root`.
 * @returns      Virtual path (always leading with `/`).
 * @throws       {Error} with code `"SANDBOX_ESCAPE"` when `target` is
 *               outside `root`.
 */
export declare function toVirtualPath(root: string, target: string): string;
//# sourceMappingURL=sandbox-paths.d.ts.map
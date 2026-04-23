/**
 * Translate a caller-supplied path into the virtual path that ReadWriteFs
 * expects. ReadWriteFs mounts the sandbox root at the virtual `/`, so a
 * host path of `<root>/sub/dir` maps to `/sub/dir`.
 *
 * Two input shapes are supported:
 * - host-absolute paths physically under `root`
 * - already-virtual POSIX paths rooted at `/`
 *
 * @param root   Host-absolute sandbox root (must already be realpath-normalised).
 * @param target Host-absolute path inside `root`, or an already-virtual path.
 * @returns      Virtual path (always leading with `/`).
 * @throws       {Error} with code `"SANDBOX_ESCAPE"` when `target` is
 *               neither physically under `root` nor a valid virtual path.
 */
export declare function toVirtualPath(root: string, target: string): string;
//# sourceMappingURL=sandbox-paths.d.ts.map
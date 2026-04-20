import path from "node:path";

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
export function toVirtualPath(root: string, target: string): string {
  const relative = path.relative(root, target);
  if (relative === "") {
    return "/";
  }
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    const err = new Error(
      `path ${JSON.stringify(target)} escapes sandbox root ${JSON.stringify(root)}`,
    ) as Error & { code?: string };
    err.code = "SANDBOX_ESCAPE";
    throw err;
  }
  return `/${relative.split(path.sep).join("/")}`;
}

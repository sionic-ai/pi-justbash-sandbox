import path from "node:path";

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
export function toVirtualPath(root: string, target: string): string {
  if (!path.isAbsolute(target)) {
    throwSandboxEscape(root, target);
  }

  const relative = path.relative(root, target);
  if (relative === "") {
    return "/";
  }

  if (!(relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))) {
    return `/${relative.split(path.sep).join("/")}`;
  }

  const normalizedVirtual = normalizeVirtualPath(target);
  if (!normalizedVirtual.startsWith("/")) {
    throwSandboxEscape(root, target);
  }

  return normalizedVirtual;
}

function normalizeVirtualPath(target: string): string {
  const normalized = path.posix.normalize(target);
  if (normalized === "/") {
    return normalized;
  }

  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

function throwSandboxEscape(root: string, target: string): never {
  const err = new Error(
    `path ${JSON.stringify(target)} escapes sandbox root ${JSON.stringify(root)}`,
  ) as Error & { code?: string };
  err.code = "SANDBOX_ESCAPE";
  throw err;
}

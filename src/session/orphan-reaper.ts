import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

/**
 * Parameters for {@link reapOrphans}.
 */
export interface ReapOrphansOptions {
  /** Directory whose children are inspected. */
  readonly baseDir: string;
  /** Entries older than `ttlMs` are considered orphaned and removed. */
  readonly ttlMs: number;
  /**
   * Clock injection point for deterministic tests. Defaults to `Date.now`.
   */
  readonly now?: () => number;
}

const SANDBOX_DIR_PATTERN = /^sess-[^/\\]+-[0-9a-f]{16}$/;

/**
 * Best-effort startup sweep: remove sandbox roots under `baseDir` whose
 * mtime is older than `ttlMs`. Returns the list of absolute paths that
 * were removed. Missing base dirs are treated as empty (no-op). Errors on
 * individual entries are swallowed so a single permission hiccup cannot
 * block agent startup.
 */
export async function reapOrphans(options: ReapOrphansOptions): Promise<string[]> {
  const { baseDir, ttlMs } = options;
  const now = options.now ?? Date.now;

  let entries: string[];
  try {
    entries = await readdir(baseDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }

  const cutoff = now() - ttlMs;
  const removed: string[] = [];

  await Promise.all(
    entries.map(async (name) => {
      if (!SANDBOX_DIR_PATTERN.test(name)) {
        return;
      }
      const full = path.join(baseDir, name);
      try {
        const info = await stat(full);
        if (!info.isDirectory()) {
          return;
        }
        if (info.mtimeMs >= cutoff) {
          return;
        }
        await rm(full, { recursive: true, force: true, maxRetries: 3 });
        removed.push(full);
      } catch {
        // Per-entry best-effort: ignore so one bad dir cannot stall startup.
      }
    }),
  );

  return removed;
}

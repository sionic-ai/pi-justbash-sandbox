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
/**
 * Best-effort startup sweep: remove sandbox roots under `baseDir` whose
 * mtime is older than `ttlMs`. Returns the list of absolute paths that
 * were removed. Missing base dirs are treated as empty (no-op). Errors on
 * individual entries are swallowed so a single permission hiccup cannot
 * block agent startup.
 */
export declare function reapOrphans(options: ReapOrphansOptions): Promise<string[]>;
//# sourceMappingURL=orphan-reaper.d.ts.map
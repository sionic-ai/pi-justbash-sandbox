import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { reapOrphans } from "../../src/session/orphan-reaper.js";

describe("reapOrphans", () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-justbash-test-")));
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it("removes sandbox dirs whose mtime is older than the TTL", async () => {
    // given
    const now = Date.now();
    const stale = path.join(baseDir, "sess-old-0011223344556677");
    await mkdir(stale, { recursive: true });
    const ancient = new Date(now - 2 * 60 * 60 * 1000); // two hours ago
    await utimes(stale, ancient, ancient);

    // when
    const removed = await reapOrphans({ baseDir, ttlMs: 60 * 60 * 1000 });

    // then
    expect(removed).toEqual([stale]);
    expect(existsSync(stale)).toBe(false);
  });

  it("leaves sandbox dirs whose mtime is within the TTL", async () => {
    // given
    const fresh = path.join(baseDir, "sess-new-8899aabbccddeeff");
    await mkdir(fresh, { recursive: true });

    // when
    const removed = await reapOrphans({ baseDir, ttlMs: 60 * 60 * 1000 });

    // then
    expect(removed).toEqual([]);
    expect(existsSync(fresh)).toBe(true);
  });

  it("ignores entries that do not match the sandbox name pattern", async () => {
    // given
    const now = Date.now();
    const ancient = new Date(now - 2 * 60 * 60 * 1000);
    const unrelatedDir = path.join(baseDir, "something-else");
    const unrelatedFile = path.join(baseDir, "stray.txt");
    await mkdir(unrelatedDir, { recursive: true });
    writeFileSync(unrelatedFile, "unrelated");
    await utimes(unrelatedDir, ancient, ancient);
    await utimes(unrelatedFile, ancient, ancient);

    // when
    const removed = await reapOrphans({ baseDir, ttlMs: 60 * 60 * 1000 });

    // then
    expect(removed).toEqual([]);
    expect(existsSync(unrelatedDir)).toBe(true);
    expect(existsSync(unrelatedFile)).toBe(true);
  });

  it("is a no-op when the base dir does not exist yet", async () => {
    // given
    const missing = path.join(baseDir, "does-not-exist");

    // when
    const removed = await reapOrphans({ baseDir: missing, ttlMs: 1000 });

    // then
    expect(removed).toEqual([]);
  });

  it("removes multiple stale dirs and reports them all", async () => {
    // given
    const now = Date.now();
    const ancient = new Date(now - 3 * 60 * 60 * 1000);
    const a = path.join(baseDir, "sess-a-00112233aabbccdd");
    const b = path.join(baseDir, "sess-b-44556677eeff0011");
    const fresh = path.join(baseDir, "sess-c-8899aabbccddeeff");
    for (const dir of [a, b, fresh]) {
      await mkdir(dir, { recursive: true });
    }
    await utimes(a, ancient, ancient);
    await utimes(b, ancient, ancient);

    // when
    const removed = await reapOrphans({ baseDir, ttlMs: 60 * 60 * 1000 });

    // then
    expect(removed.sort()).toEqual([a, b].sort());
    expect(existsSync(a)).toBe(false);
    expect(existsSync(b)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
  });
});

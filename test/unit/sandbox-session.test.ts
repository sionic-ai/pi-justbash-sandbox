import { mkdtempSync, realpathSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SandboxSession } from "../../src/session/sandbox-session.js";

describe("SandboxSession.ensure", () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-justbash-test-")));
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it("creates an isolated root under the base dir keyed by sessionId", async () => {
    // given
    const session = new SandboxSession({ baseDir, sessionId: "abc123" });

    // when
    const root = await session.ensure();

    // then
    const parent = path.dirname(root);
    expect(parent).toBe(baseDir);
    expect(path.basename(root)).toMatch(/^sess-abc123-[0-9a-f]{16}$/);
    expect(statSync(root).isDirectory()).toBe(true);
  });

  it("is idempotent: repeated ensure() returns the same root", async () => {
    // given
    const session = new SandboxSession({ baseDir, sessionId: "idem" });
    const first = await session.ensure();

    // when
    const second = await session.ensure();

    // then
    expect(second).toBe(first);
    expect(statSync(second).isDirectory()).toBe(true);
  });

  it("creates distinct roots for distinct sessionIds under the same base", async () => {
    // given
    const a = new SandboxSession({ baseDir, sessionId: "A" });
    const b = new SandboxSession({ baseDir, sessionId: "B" });

    // when
    const rootA = await a.ensure();
    const rootB = await b.ensure();

    // then
    expect(rootA).not.toBe(rootB);
    expect(path.dirname(rootA)).toBe(baseDir);
    expect(path.dirname(rootB)).toBe(baseDir);
  });

  it("exposes the active root via getRoot() once ensured", async () => {
    // given
    const session = new SandboxSession({ baseDir, sessionId: "ready" });

    // when
    const root = await session.ensure();

    // then
    expect(session.getRoot()).toBe(root);
  });

  it("throws from getRoot() before ensure() is called", () => {
    // given
    const session = new SandboxSession({ baseDir, sessionId: "not-yet" });

    // when / then
    expect(() => session.getRoot()).toThrow(/not ensured/i);
  });
});

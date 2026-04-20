import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SandboxSession } from "../../src/session/sandbox-session.js";

describe("SandboxSession.cleanup", () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-justbash-test-")));
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it("removes the root and every nested file / directory", async () => {
    // given
    const session = new SandboxSession({ baseDir, sessionId: "with-children" });
    const root = await session.ensure();
    await mkdir(path.join(root, "nested", "deep"), { recursive: true });
    await writeFile(path.join(root, "nested", "a.txt"), "hello");
    await writeFile(path.join(root, "nested", "deep", "b.txt"), "world");

    // when
    await session.cleanup();

    // then
    expect(existsSync(root)).toBe(false);
  });

  it("allows ensure() to recreate a fresh root after cleanup", async () => {
    // given
    const session = new SandboxSession({ baseDir, sessionId: "reborn" });
    const first = await session.ensure();
    await session.cleanup();

    // when
    const second = await session.ensure();

    // then
    expect(existsSync(second)).toBe(true);
    // same suffix (instance-scoped), so the path is identical — just recreated.
    expect(second).toBe(first);
  });

  it("is a no-op when ensure() has never run", async () => {
    // given
    const session = new SandboxSession({ baseDir, sessionId: "pristine" });

    // when / then
    await expect(session.cleanup()).resolves.toBeUndefined();
  });

  it("removes the root even when it contains symlinks (without following them)", async () => {
    // given
    const outside = path.join(baseDir, "outside.txt");
    writeFileSync(outside, "must survive cleanup");
    const session = new SandboxSession({ baseDir, sessionId: "symlinked" });
    const root = await session.ensure();
    await symlink(outside, path.join(root, "link-to-outside"));

    // when
    await session.cleanup();

    // then
    expect(existsSync(root)).toBe(false);
    expect(existsSync(outside)).toBe(true);
  });

  it("tolerates the root being deleted out-of-band between ensure and cleanup", async () => {
    // given
    const session = new SandboxSession({ baseDir, sessionId: "ghosted" });
    const root = await session.ensure();
    rmSync(root, { recursive: true, force: true });

    // when / then
    await expect(session.cleanup()).resolves.toBeUndefined();
  });
});

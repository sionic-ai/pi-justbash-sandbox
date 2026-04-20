import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SandboxSessionRegistry } from "../../src/session/session-registry.js";

describe("SandboxSessionRegistry", () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-justbash-test-")));
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it("acquire() creates a SandboxSession on first call and returns the cached one after", async () => {
    // given
    const registry = new SandboxSessionRegistry({ baseDir });

    // when
    const first = await registry.acquire("ses-1");
    const second = await registry.acquire("ses-1");

    // then
    expect(second).toBe(first);
    expect(existsSync(second.getRoot())).toBe(true);
  });

  it("keeps different pi sessions in separate SandboxSessions", async () => {
    // given
    const registry = new SandboxSessionRegistry({ baseDir });

    // when
    const a = await registry.acquire("ses-a");
    const b = await registry.acquire("ses-b");

    // then
    expect(a).not.toBe(b);
    expect(a.getRoot()).not.toBe(b.getRoot());
  });

  it("release() cleans up the session and evicts it from the registry", async () => {
    // given
    const registry = new SandboxSessionRegistry({ baseDir });
    const session = await registry.acquire("ses-release");
    const root = session.getRoot();

    // when
    await registry.release("ses-release");

    // then
    expect(existsSync(root)).toBe(false);
    expect(registry.has("ses-release")).toBe(false);
  });

  it("release() on an unknown session id is a no-op", async () => {
    // given
    const registry = new SandboxSessionRegistry({ baseDir });

    // when / then
    await expect(registry.release("missing")).resolves.toBeUndefined();
  });

  it("releaseAll() cleans every tracked session and empties the map", async () => {
    // given
    const registry = new SandboxSessionRegistry({ baseDir });
    const rootA = (await registry.acquire("ses-1")).getRoot();
    const rootB = (await registry.acquire("ses-2")).getRoot();

    // when
    await registry.releaseAll();

    // then
    expect(existsSync(rootA)).toBe(false);
    expect(existsSync(rootB)).toBe(false);
    expect(registry.size()).toBe(0);
  });
});

describe("SandboxSessionRegistry (flat mode)", () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-justbash-test-")));
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it("acquire() returns a session whose root is baseDir itself", async () => {
    // given
    const registry = new SandboxSessionRegistry({ baseDir, flat: true });

    // when
    const session = await registry.acquire("ses-flat-1");

    // then
    expect(session.getRoot()).toBe(baseDir);
  });

  it("different session ids share the same root directory", async () => {
    // given
    const registry = new SandboxSessionRegistry({ baseDir, flat: true });

    // when
    const a = await registry.acquire("ses-flat-a");
    const b = await registry.acquire("ses-flat-b");

    // then
    expect(a.getRoot()).toBe(b.getRoot());
    expect(a.getRoot()).toBe(baseDir);
  });

  it("release() evicts the session but does not delete baseDir", async () => {
    // given
    const registry = new SandboxSessionRegistry({ baseDir, flat: true });
    await registry.acquire("ses-flat-release");

    // when
    await registry.release("ses-flat-release");

    // then
    expect(existsSync(baseDir)).toBe(true);
    expect(registry.has("ses-flat-release")).toBe(false);
  });

  it("releaseAll() empties the map but preserves baseDir", async () => {
    // given
    const registry = new SandboxSessionRegistry({ baseDir, flat: true });
    await registry.acquire("ses-1");
    await registry.acquire("ses-2");

    // when
    await registry.releaseAll();

    // then
    expect(existsSync(baseDir)).toBe(true);
    expect(registry.size()).toBe(0);
  });
});

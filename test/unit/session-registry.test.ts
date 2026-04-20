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

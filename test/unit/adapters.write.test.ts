import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ReadWriteFs } from "just-bash";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WriteAdapter } from "../../src/adapters/write-adapter.js";

describe("WriteAdapter", () => {
  let root: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-justbash-test-")));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("writes a file inside the sandbox with the provided UTF-8 content", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new WriteAdapter({ fs, root });
    const target = path.join(root, "out.txt");

    // when
    await adapter.writeFile(target, "안녕 pi\n");

    // then
    expect(existsSync(target)).toBe(true);
    expect(readFileSync(target, "utf8")).toBe("안녕 pi\n");
  });

  it("creates missing parent directories on writeFile()", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new WriteAdapter({ fs, root });
    const target = path.join(root, "deeper", "still", "out.txt");

    // when
    await adapter.writeFile(target, "content");

    // then
    expect(readFileSync(target, "utf8")).toBe("content");
  });

  it("mkdir() recursively creates intermediate dirs", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new WriteAdapter({ fs, root });
    const dir = path.join(root, "a", "b", "c");

    // when
    await adapter.mkdir(dir);

    // then
    expect(statSync(dir).isDirectory()).toBe(true);
  });

  it("writeFile() rejects paths outside the sandbox", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new WriteAdapter({ fs, root });
    const outside = path.join(path.dirname(root), "outside.txt");

    // when / then
    await expect(adapter.writeFile(outside, "nope")).rejects.toThrow();
    expect(existsSync(outside)).toBe(false);
  });
});

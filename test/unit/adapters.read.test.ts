import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ReadWriteFs } from "just-bash";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ReadAdapter } from "../../src/adapters/read-adapter.js";

describe("ReadAdapter", () => {
  let root: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-justbash-test-")));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("reads a UTF-8 file inside the sandbox via ReadWriteFs", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new ReadAdapter({ fs, root });
    const target = path.join(root, "hello.txt");
    await writeFile(target, "안녕 pi\n", "utf8");

    // when
    const buf = await adapter.readFile(target);

    // then
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.toString("utf8")).toBe("안녕 pi\n");
  });

  it("access() resolves for files inside the sandbox", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new ReadAdapter({ fs, root });
    const target = path.join(root, "ok.txt");
    await writeFile(target, "ok", "utf8");

    // when / then
    await expect(adapter.access(target)).resolves.toBeUndefined();
  });

  it("access() rejects for paths outside the sandbox", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new ReadAdapter({ fs, root });
    const outside = path.join(path.dirname(root), "outside.txt");

    // when / then
    await expect(adapter.access(outside)).rejects.toThrow();
  });

  it("readFile() rejects for paths outside the sandbox", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new ReadAdapter({ fs, root });
    const outside = path.join(path.dirname(root), "outside.txt");

    // when / then
    await expect(adapter.readFile(outside)).rejects.toThrow();
  });
});

import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ReadWriteFs } from "just-bash";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EditAdapter } from "../../src/adapters/edit-adapter.js";

describe("EditAdapter", () => {
  let root: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-justbash-test-")));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("reads a file through the sandbox fs and returns a Buffer", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new EditAdapter({ fs, root });
    const target = path.join(root, "a.txt");
    writeFileSync(target, "original text", "utf8");

    // when
    const buf = await adapter.readFile(target);

    // then
    expect(buf.toString("utf8")).toBe("original text");
  });

  it("writes a file through the sandbox fs", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new EditAdapter({ fs, root });
    const target = path.join(root, "b.txt");
    writeFileSync(target, "before", "utf8");

    // when
    await adapter.writeFile(target, "after");

    // then
    expect(readFileSync(target, "utf8")).toBe("after");
  });

  it("supports the read-then-write flow the edit tool relies on", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new EditAdapter({ fs, root });
    const target = path.join(root, "c.txt");
    writeFileSync(target, "hello world", "utf8");

    // when
    const current = (await adapter.readFile(target)).toString("utf8");
    const updated = current.replace("world", "pi");
    await adapter.writeFile(target, updated);

    // then
    expect(readFileSync(target, "utf8")).toBe("hello pi");
  });

  it("supports the read-then-write flow when given virtual paths", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new EditAdapter({ fs, root });
    const target = path.join(root, "virtual.txt");
    writeFileSync(target, "hello world", "utf8");

    // when
    const current = (await adapter.readFile("/virtual.txt")).toString("utf8");
    const updated = current.replace("world", "pi");
    await adapter.writeFile("/virtual.txt", updated);

    // then
    expect(readFileSync(target, "utf8")).toBe("hello pi");
  });

  it("access() rejects paths outside the sandbox", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new EditAdapter({ fs, root });
    const outside = path.join(path.dirname(root), "outside.txt");

    // when / then
    // Proposal A reinterprets this host path as a virtual path, so the rejection
    // now comes from the sandbox fs reporting a missing file rather than from
    // toVirtualPath() throwing SANDBOX_ESCAPE.
    await expect(adapter.access(outside)).rejects.toThrow();
  });

  it("access() resolves for files inside the sandbox", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new EditAdapter({ fs, root });
    const target = path.join(root, "ok.txt");
    writeFileSync(target, "ok", "utf8");

    // when / then
    await expect(adapter.access(target)).resolves.toBeUndefined();
  });
});

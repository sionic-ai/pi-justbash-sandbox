import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ReadWriteFs } from "just-bash";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ReadAdapter } from "../../src/adapters/read-adapter.js";

describe("ReadAdapter.detectImageMimeType", () => {
  let root: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-justbash-test-")));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("detects PNG via magic bytes", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new ReadAdapter({ fs, root });
    const target = path.join(root, "pic.png");
    // 8-byte PNG signature + minimal payload
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]),
    ]);
    await writeFile(target, png);

    // when
    const mime = await adapter.detectImageMimeType?.(target);

    // then
    expect(mime).toBe("image/png");
  });

  it("detects JPEG via magic bytes", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new ReadAdapter({ fs, root });
    const target = path.join(root, "pic.jpg");
    const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from([0, 0, 0, 0])]);
    await writeFile(target, jpg);

    // when
    const mime = await adapter.detectImageMimeType?.(target);

    // then
    expect(mime).toBe("image/jpeg");
  });

  it("detects GIF via magic bytes", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new ReadAdapter({ fs, root });
    const target = path.join(root, "pic.gif");
    await writeFile(target, Buffer.from("GIF89a\x00\x00\x00\x00", "binary"));

    // when
    const mime = await adapter.detectImageMimeType?.(target);

    // then
    expect(mime).toBe("image/gif");
  });

  it("detects WebP via RIFF/WEBP markers", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new ReadAdapter({ fs, root });
    const target = path.join(root, "pic.webp");
    const webp = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from("WEBP", "ascii"),
      Buffer.from([0, 0, 0, 0]),
    ]);
    await writeFile(target, webp);

    // when
    const mime = await adapter.detectImageMimeType?.(target);

    // then
    expect(mime).toBe("image/webp");
  });

  it("returns null for text files", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new ReadAdapter({ fs, root });
    const target = path.join(root, "note.txt");
    await writeFile(target, "hello pi\n", "utf8");

    // when
    const mime = await adapter.detectImageMimeType?.(target);

    // then
    expect(mime).toBeNull();
  });
});

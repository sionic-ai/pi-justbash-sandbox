import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ReadWriteFs } from "just-bash";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BashAdapter } from "../../src/adapters/bash-adapter.js";

describe("BashAdapter.exec (stdout)", () => {
  let root: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-justbash-test-")));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("echoes to stdout and returns exit code 0", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new BashAdapter({ fs, root });
    const chunks: Buffer[] = [];

    // when
    const result = await adapter.exec("echo hello", root, {
      onData: (data) => chunks.push(data),
    });

    // then
    expect(result.exitCode).toBe(0);
    const combined = Buffer.concat(chunks).toString("utf8");
    expect(combined).toContain("hello");
  });

  it("forwards stdout line-by-line via onData", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new BashAdapter({ fs, root });
    const chunks: string[] = [];

    // when
    const result = await adapter.exec("printf 'one\\ntwo\\nthree\\n'", root, {
      onData: (data) => chunks.push(data.toString("utf8")),
    });

    // then
    expect(result.exitCode).toBe(0);
    expect(chunks.join("")).toBe("one\ntwo\nthree\n");
  });

  it("runs grep inside the sandboxed shell", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new BashAdapter({ fs, root });
    const chunks: string[] = [];
    writeFileSync(path.join(root, "sample.txt"), "alpha\nbeta\n", "utf8");

    // when
    const result = await adapter.exec("grep beta sample.txt", root, {
      onData: (data) => chunks.push(data.toString("utf8")),
    });

    // then
    expect(result.exitCode).toBe(0);
    expect(chunks.join("")).toContain("beta");
  });
});

import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ReadWriteFs } from "just-bash";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BashAdapter } from "../../src/adapters/bash-adapter.js";

describe("BashAdapter.exec (stderr + non-zero exit)", () => {
  let root: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-justbash-test-")));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("forwards stderr through onData and preserves exit code 0", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new BashAdapter({ fs, root });
    const chunks: string[] = [];

    // when
    const result = await adapter.exec("echo oops 1>&2", root, {
      onData: (data) => chunks.push(data.toString("utf8")),
    });

    // then
    expect(result.exitCode).toBe(0);
    expect(chunks.join("")).toContain("oops");
  });

  it("propagates non-zero exit codes", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new BashAdapter({ fs, root });
    const chunks: string[] = [];

    // when
    const result = await adapter.exec("exit 42", root, {
      onData: (data) => chunks.push(data.toString("utf8")),
    });

    // then
    expect(result.exitCode).toBe(42);
  });

  it("surfaces both stdout and stderr from the same command", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new BashAdapter({ fs, root });
    const chunks: string[] = [];

    // when
    const result = await adapter.exec("echo out; echo err 1>&2; exit 3", root, {
      onData: (data) => chunks.push(data.toString("utf8")),
    });

    // then
    expect(result.exitCode).toBe(3);
    const combined = chunks.join("");
    expect(combined).toContain("out");
    expect(combined).toContain("err");
  });
});

import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ReadWriteFs } from "just-bash";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BashAdapter } from "../../src/adapters/bash-adapter.js";

describe("BashAdapter.exec (cancellation)", () => {
  let root: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-justbash-test-")));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("aborts a long-running command when the signal fires", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new BashAdapter({ fs, root });
    const controller = new AbortController();

    // when
    setTimeout(() => controller.abort(), 50);
    const start = Date.now();
    const result = await adapter.exec("sleep 5", root, {
      onData: () => {},
      signal: controller.signal,
    });
    const elapsed = Date.now() - start;

    // then
    expect(result.exitCode).not.toBe(0);
    expect(elapsed).toBeLessThan(2_000);
  });

  it("respects the timeout option and aborts before completion", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new BashAdapter({ fs, root });

    // when
    const start = Date.now();
    const result = await adapter.exec("sleep 5", root, {
      onData: () => {},
      timeout: 50,
    });
    const elapsed = Date.now() - start;

    // then
    expect(result.exitCode).not.toBe(0);
    expect(elapsed).toBeLessThan(2_000);
  });
});

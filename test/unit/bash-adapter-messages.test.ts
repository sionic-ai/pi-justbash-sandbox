import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ReadWriteFs } from "just-bash";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BashAdapter } from "../../src/adapters/bash-adapter.js";
import { Redactor } from "../../src/security/redactor.js";

describe("BashAdapter synthesised error messages", () => {
  let root: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-justbash-test-")));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("cwd-escape message goes through the redactor before reaching pi", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const secret = "sk-fake-cwd-path-like-secret-value";
    const redactor = Redactor.fromEnv({ ANTHROPIC_API_KEY: secret });
    const adapter = new BashAdapter({ fs, root, redactor });
    const chunks: string[] = [];
    const relativeCwd = `./relative-${secret}`;

    // when
    const result = await adapter.exec("ls", relativeCwd, {
      onData: (data) => chunks.push(data.toString("utf8")),
    });

    // then
    expect(result.exitCode).toBe(126);
    const message = chunks.join("");
    expect(message).not.toContain(secret);
    expect(message).toContain("[REDACTED]");
    expect(message).toContain("is outside the sandbox");
  });

  it("timeout message goes through the redactor as well", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const redactor = Redactor.fromEnv({
      ANTHROPIC_API_KEY: "sk-fake-timeout-path-secret-value",
    });
    const adapter = new BashAdapter({ fs, root, redactor });
    const chunks: string[] = [];

    // when
    const result = await adapter.exec("sleep 1", root, {
      onData: (data) => chunks.push(data.toString("utf8")),
      timeout: 50,
    });

    // then
    expect(result.exitCode).toBe(124);
    const out = chunks.join("");
    expect(out).toContain("timed out");
  });
});

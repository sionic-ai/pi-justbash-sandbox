import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ReadWriteFs } from "just-bash";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BashAdapter } from "../../src/adapters/bash-adapter.js";
import { Redactor } from "../../src/security/redactor.js";

describe("BashAdapter shell env stripping", () => {
  let root: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-justbash-test-")));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("strip=true removes secret entries so the shell expansion returns the default", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const secret = "sk-fake-defense-in-depth-value";
    const adapter = new BashAdapter({
      fs,
      root,
      stripSecretEnvFromShell: true,
      redactor: Redactor.noop(),
    });
    const chunks: string[] = [];

    // when
    // biome-ignore lint/suspicious/noTemplateCurlyInString: literal shell expansion under test
    const result = await adapter.exec('echo "val=${ANTHROPIC_API_KEY:-missing}"', root, {
      onData: (data) => chunks.push(data.toString("utf8")),
      env: { PATH: "/usr/bin", HOME: "/Users/me", ANTHROPIC_API_KEY: secret },
    });

    // then
    expect(result.exitCode).toBe(0);
    const out = chunks.join("");
    expect(out).not.toContain(secret);
    expect(out).toContain("missing");
  });

  it("strip=false keeps the secret in the shell so it expands inline (noop redactor)", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const secret = "sk-fake-leaking-without-strip-value";
    const adapter = new BashAdapter({
      fs,
      root,
      stripSecretEnvFromShell: false,
      redactor: Redactor.noop(),
    });
    const chunks: string[] = [];

    // when
    // biome-ignore lint/suspicious/noTemplateCurlyInString: literal shell expansion under test
    const result = await adapter.exec('echo "val=${ANTHROPIC_API_KEY:-missing}"', root, {
      onData: (data) => chunks.push(data.toString("utf8")),
      env: { PATH: "/usr/bin", ANTHROPIC_API_KEY: secret },
    });

    // then
    expect(result.exitCode).toBe(0);
    const out = chunks.join("");
    expect(out).toContain(secret);
    expect(out).not.toContain("missing");
  });

  it("strip=true with an active redactor: agent sees the default AND any stray literal is redacted", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const secret = "sk-fake-combined-defense-value";
    const redactor = Redactor.fromEnv({ ANTHROPIC_API_KEY: secret });
    const adapter = new BashAdapter({
      fs,
      root,
      stripSecretEnvFromShell: true,
      redactor,
    });
    const chunks: string[] = [];

    // when
    const result = await adapter.exec(`echo "lit=${secret}"`, root, {
      onData: (data) => chunks.push(data.toString("utf8")),
      env: { PATH: "/usr/bin", ANTHROPIC_API_KEY: secret },
    });

    // then
    expect(result.exitCode).toBe(0);
    const out = chunks.join("");
    expect(out).not.toContain(secret);
    expect(out).toContain("[REDACTED]");
  });
});

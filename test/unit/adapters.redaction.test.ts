import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ReadWriteFs } from "just-bash";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BashAdapter } from "../../src/adapters/bash-adapter.js";
import { EditAdapter } from "../../src/adapters/edit-adapter.js";
import { ReadAdapter } from "../../src/adapters/read-adapter.js";
import { WriteAdapter } from "../../src/adapters/write-adapter.js";
import { Redactor } from "../../src/security/redactor.js";

describe("Adapter redaction", () => {
  let root: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-justbash-test-")));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("BashAdapter redacts a secret value printed via echo through onData", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const redactor = Redactor.fromEnv({ ANTHROPIC_API_KEY: "sk-anthropic-secret-123" });
    const adapter = new BashAdapter({ fs, root, redactor });
    const chunks: string[] = [];

    // when
    const result = await adapter.exec("echo 'leak=sk-anthropic-secret-123 done'", root, {
      onData: (data) => chunks.push(data.toString("utf8")),
    });

    // then
    expect(result.exitCode).toBe(0);
    const combined = chunks.join("");
    expect(combined).not.toContain("sk-anthropic-secret-123");
    expect(combined).toContain("[REDACTED]");
  });

  it("BashAdapter redacts NAME=value form even if value changed after snapshot", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const redactor = Redactor.fromEnv({ ANTHROPIC_API_KEY: "snapshot-value" });
    const adapter = new BashAdapter({ fs, root, redactor });
    const chunks: string[] = [];

    // when
    const result = await adapter.exec("echo ANTHROPIC_API_KEY=brand-new-runtime-value", root, {
      onData: (data) => chunks.push(data.toString("utf8")),
    });

    // then
    expect(result.exitCode).toBe(0);
    const combined = chunks.join("");
    expect(combined).toContain("ANTHROPIC_API_KEY=[REDACTED]");
    expect(combined).not.toContain("brand-new-runtime-value");
  });

  it("BashAdapter leaves safe strings untouched", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const redactor = Redactor.fromEnv({
      ANTHROPIC_API_KEY: "sk-x-long-secret-value",
      HOME: "/Users/yeongyu",
      PATH: "/usr/local/bin:/usr/bin",
    });
    const adapter = new BashAdapter({ fs, root, redactor });
    const chunks: string[] = [];

    // when
    const result = await adapter.exec("echo hello /usr/local/bin", root, {
      onData: (data) => chunks.push(data.toString("utf8")),
    });

    // then
    expect(result.exitCode).toBe(0);
    expect(chunks.join("")).toBe("hello /usr/local/bin\n");
  });

  it("ReadAdapter redacts secret values from a UTF-8 text file", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const redactor = Redactor.fromEnv({ GITHUB_TOKEN: "ghp_thisistotallythetoken" });
    const adapter = new ReadAdapter({ fs, root, redactor });
    const target = path.join(root, "config.txt");
    writeFileSync(target, "token=ghp_thisistotallythetoken\nuser=me\n", "utf8");

    // when
    const buf = await adapter.readFile(target);

    // then
    expect(buf.toString("utf8")).toBe("token=[REDACTED]\nuser=me\n");
  });

  it("ReadAdapter does NOT redact image content (magic bytes detected)", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const secret = "sk-thisshouldnotbemangled";
    const redactor = Redactor.fromEnv({ ANTHROPIC_API_KEY: secret });
    const adapter = new ReadAdapter({ fs, root, redactor });
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from(secret, "utf8"),
    ]);
    const target = path.join(root, "pic.png");
    writeFileSync(target, png);

    // when
    const buf = await adapter.readFile(target);

    // then
    expect(buf.equals(png)).toBe(true);
  });

  it("ReadAdapter does NOT redact content that looks binary (contains NUL byte)", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const redactor = Redactor.fromEnv({ ANTHROPIC_API_KEY: "mysecretvaluelong" });
    const adapter = new ReadAdapter({ fs, root, redactor });
    const payload = Buffer.concat([
      Buffer.from("header\0", "utf8"),
      Buffer.from("mysecretvaluelong", "utf8"),
    ]);
    const target = path.join(root, "blob.bin");
    writeFileSync(target, payload);

    // when
    const buf = await adapter.readFile(target);

    // then
    expect(buf.equals(payload)).toBe(true);
  });

  it("WriteAdapter redacts secret values before the bytes hit disk", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const redactor = Redactor.fromEnv({ ANTHROPIC_API_KEY: "sk-exfil-attempt-value" });
    const adapter = new WriteAdapter({ fs, root, redactor });
    const target = path.join(root, "exfil.txt");

    // when
    await adapter.writeFile(target, "key=sk-exfil-attempt-value");

    // then
    expect(readFileSync(target, "utf8")).toBe("key=[REDACTED]");
  });

  it("EditAdapter redacts on both read and write", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const secret = "supersecret-value-xyz";
    const redactor = Redactor.fromEnv({ GITHUB_TOKEN: secret });
    const adapter = new EditAdapter({ fs, root, redactor });
    const target = path.join(root, "config.txt");
    writeFileSync(target, `token=${secret}\n`, "utf8");

    // when
    const buf = await adapter.readFile(target);
    await adapter.writeFile(target, `rotated=${secret}\n`);

    // then
    expect(buf.toString("utf8")).toBe("token=[REDACTED]\n");
    expect(readFileSync(target, "utf8")).toBe("rotated=[REDACTED]\n");
  });

  it("noop redactor passes content through untouched (backwards compatible)", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new BashAdapter({ fs, root, redactor: Redactor.noop() });
    const chunks: string[] = [];

    // when
    await adapter.exec("echo 'sk-whatever'", root, {
      onData: (data) => chunks.push(data.toString("utf8")),
    });

    // then
    expect(chunks.join("")).toBe("sk-whatever\n");
  });
});

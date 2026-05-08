import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ReadWriteFs } from "just-bash";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BashAdapter } from "../../src/adapters/bash-adapter.js";

describe("UTF-8 preservation through just-bash commands", () => {
  let root: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-justbash-test-")));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("preserves UTF-8 through jq path-assignment", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new BashAdapter({ fs, root });
    const chunks: string[] = [];
    const source = '{"name":"한글 데이터","emoji":"🌍"}';
    writeFileSync(path.join(root, "sample.json"), source, "utf8");

    // when
    const result = await adapter.exec("jq '.name = \"한글 테스트 🇰🇷\"' sample.json", root, {
      onData: (data) => chunks.push(data.toString("utf8")),
    });

    // then
    expect(result.exitCode).toBe(0);
    const combined = chunks.join("");
    expect(combined).toContain("한글 테스트 🇰🇷");
  });

  it("preserves UTF-8 through sed substitution", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new BashAdapter({ fs, root });
    const chunks: string[] = [];
    writeFileSync(path.join(root, "sample.txt"), "alpha\n한글 데이터\nomega\n", "utf8");

    // when
    const result = await adapter.exec("sed 's/한글 데이터/한글 테스트 🇰🇷/' sample.txt", root, {
      onData: (data) => chunks.push(data.toString("utf8")),
    });

    // then
    expect(result.exitCode).toBe(0);
    expect(chunks.join("")).toContain("한글 테스트 🇰🇷");
  });

  it("preserves UTF-8 through grep matching", async () => {
    // given
    const fs = new ReadWriteFs({ root, allowSymlinks: false });
    const adapter = new BashAdapter({ fs, root });
    const chunks: string[] = [];
    writeFileSync(path.join(root, "sample-grep.txt"), "first\n한글 테스트 🇰🇷\nlast\n", "utf8");

    // when
    const result = await adapter.exec("grep '한글 테스트 🇰🇷' sample-grep.txt", root, {
      onData: (data) => chunks.push(data.toString("utf8")),
    });

    // then
    expect(result.exitCode).toBe(0);
    expect(chunks.join("")).toContain("한글 테스트 🇰🇷");
  });
});

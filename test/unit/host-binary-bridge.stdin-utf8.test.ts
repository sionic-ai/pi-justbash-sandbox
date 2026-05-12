import { Buffer } from "node:buffer";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Bash } from "just-bash";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHostBinaryBridges } from "../../src/adapters/host-binary-bridge.js";

describe("createHostBinaryBridges stdin handling", () => {
  let root: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-justbash-test-")));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("forwards multibyte UTF-8 stdin to the host binary byte-for-byte", async () => {
    // given
    const payload = "한글 테스트 🇰🇷";
    const bash = new Bash({
      cwd: root,
      customCommands: createHostBinaryBridges({ names: ["cat"] }),
    });

    // when
    const result = await bash.exec(`echo '${payload}' | cat`);

    // then
    const expectedOutput = `${payload}\n`;
    expect(result.exitCode).toBe(0);
    expect(Buffer.from(result.stdout, "utf8")).toEqual(Buffer.from(expectedOutput, "utf8"));
    expect(result.stdout).toBe(expectedOutput);
  });
});

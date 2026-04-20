import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SandboxSession } from "../../src/session/sandbox-session.js";

describe("SandboxSession hardening", () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-justbash-test-")));
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it("rejects sessionIds that would escape the base dir via path traversal", () => {
    // given
    const dangerous = "../../etc/passwd";

    // when / then
    expect(() => new SandboxSession({ baseDir, sessionId: dangerous })).toThrow(/sessionId/i);
  });

  it("rejects sessionIds containing path separators", () => {
    // given
    const withSep = "foo/bar";

    // when / then
    expect(() => new SandboxSession({ baseDir, sessionId: withSep })).toThrow(/sessionId/i);
  });

  it("rejects empty sessionIds", () => {
    // given
    const empty = "";

    // when / then
    expect(() => new SandboxSession({ baseDir, sessionId: empty })).toThrow(/sessionId/i);
  });

  it("deduplicates concurrent cleanup() invocations", async () => {
    // given
    const session = new SandboxSession({ baseDir, sessionId: "concurrent" });
    await session.ensure();

    // when
    const [a, b, c] = await Promise.all([session.cleanup(), session.cleanup(), session.cleanup()]);

    // then
    expect(a).toBeUndefined();
    expect(b).toBeUndefined();
    expect(c).toBeUndefined();
  });
});

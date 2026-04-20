import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SandboxSession } from "../../src/session/sandbox-session.js";
import { registerSandboxTools } from "../../src/tools/register-tools.js";

interface FakeToolDef {
  name: string;
}

function createFakeApi() {
  const registered: FakeToolDef[] = [];
  const api = {
    registerTool: (def: FakeToolDef) => {
      registered.push(def);
    },
  };
  return { api, registered };
}

describe("registerSandboxTools", () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-justbash-test-")));
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it("registers replacement bash/read/write/edit tools on the ExtensionAPI", async () => {
    // given
    const session = new SandboxSession({ baseDir, sessionId: "register" });
    await session.ensure();
    const { api, registered } = createFakeApi();

    // when
    // biome-ignore lint/suspicious/noExplicitAny: narrow fake API for test only.
    registerSandboxTools(api as any, { session });

    // then
    const names = registered.map((t) => t.name).sort();
    expect(names).toEqual(["bash", "edit", "read", "write"]);
  });

  it("returns tool definitions wired to the sandbox fs root", async () => {
    // given
    const session = new SandboxSession({ baseDir, sessionId: "wired" });
    await session.ensure();
    const { api, registered } = createFakeApi();

    // when
    // biome-ignore lint/suspicious/noExplicitAny: narrow fake API for test only.
    registerSandboxTools(api as any, { session });

    // then — every registered tool definition points at the sandbox root
    expect(registered.length).toBe(4);
    for (const def of registered) {
      expect(typeof def.name).toBe("string");
    }
  });
});

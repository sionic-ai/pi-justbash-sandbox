import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import createJustBashExtension from "../../src/index.js";

// biome-ignore lint/suspicious/noExplicitAny: fake ExtensionAPI for integration tests.
type AnyHandler = (event: any, ctx: any) => any;

function createFakeApi(sandboxRoot?: string) {
  const registeredTools = new Map<string, { name: string }>();
  const handlers = new Map<string, AnyHandler>();
  const flags = new Map<string, unknown>();
  const flagValues = new Map<string, boolean | string | undefined>(
    sandboxRoot !== undefined ? [["sandbox-root", sandboxRoot]] : [],
  );
  const api = {
    // biome-ignore lint/suspicious/noExplicitAny: test-only fake.
    registerTool: (tool: any) => {
      registeredTools.set(tool.name, { name: tool.name });
    },
    on: (event: string, handler: AnyHandler) => {
      handlers.set(event, handler);
    },
    registerFlag: (name: string, options: unknown) => {
      flags.set(name, options);
    },
    getFlag: (name: string) => flagValues.get(name),
  };
  return { api, registeredTools, handlers, flags };
}

function createFakeCtx(sessionId: string) {
  return {
    sessionManager: {
      getSessionId: () => sessionId,
    },
  };
}

describe("default extension factory", () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-justbash-test-")));
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it("registers the grep replacement tool and a tool_call blocker at factory time", async () => {
    // given
    const { api, registeredTools, handlers } = createFakeApi(baseDir);

    // when
    // biome-ignore lint/suspicious/noExplicitAny: test-only fake ExtensionAPI.
    await createJustBashExtension(api as any);

    // then
    expect(registeredTools.has("grep")).toBe(true);
    expect(handlers.has("tool_call")).toBe(true);
    expect(handlers.has("session_start")).toBe(true);
    expect(handlers.has("session_shutdown")).toBe(true);
  });

  it("session_start registers the sandboxed bash/read/write/edit tools", async () => {
    // given
    const { api, registeredTools, handlers } = createFakeApi(baseDir);
    // biome-ignore lint/suspicious/noExplicitAny: test-only fake ExtensionAPI.
    await createJustBashExtension(api as any);
    const start = handlers.get("session_start");

    // when
    // biome-ignore lint/suspicious/noExplicitAny: test-only event object.
    await start?.({} as any, createFakeCtx("ses-boot") as any);

    // then
    for (const name of ["bash", "read", "write", "edit", "grep"]) {
      expect(registeredTools.has(name)).toBe(true);
    }
  });

  it("session_shutdown cleans the sandbox root", async () => {
    // given
    const { api, handlers } = createFakeApi(baseDir);
    // biome-ignore lint/suspicious/noExplicitAny: test-only fake ExtensionAPI.
    await createJustBashExtension(api as any);
    const start = handlers.get("session_start");
    const shutdown = handlers.get("session_shutdown");
    const ctx = createFakeCtx("ses-shutdown");
    // biome-ignore lint/suspicious/noExplicitAny: test-only event object.
    await start?.({} as any, ctx as any);

    // After session_start the sandbox root must physically exist.
    const children = await import("node:fs").then((m) =>
      m.readdirSync(baseDir).filter((n) => n.startsWith("sess-ses-shutdown-")),
    );
    expect(children.length).toBe(1);
    const createdRoot = path.join(baseDir, children[0] as string);
    expect(existsSync(createdRoot)).toBe(true);

    // when
    // biome-ignore lint/suspicious/noExplicitAny: test-only event object.
    await shutdown?.({} as any, ctx as any);

    // then
    expect(existsSync(createdRoot)).toBe(false);
  });
});

import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installSandboxLifecycle } from "../../src/lifecycle/install-lifecycle.js";
import { SandboxSessionRegistry } from "../../src/session/session-registry.js";

// biome-ignore lint/suspicious/noExplicitAny: narrow test-only fake of ExtensionAPI.
type AnyHandler = (event: any, ctx: any) => any;

function createFakeApi() {
  const handlers = new Map<string, AnyHandler>();
  const api = {
    on: (event: string, handler: AnyHandler) => {
      handlers.set(event, handler);
    },
  };
  return { api, handlers };
}

function createFakeCtx(sessionId: string) {
  return {
    sessionManager: {
      getSessionId: () => sessionId,
    },
  };
}

describe("installSandboxLifecycle", () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-justbash-test-")));
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it("session_start handler creates a sandbox root for the current session id", async () => {
    // given
    const registry = new SandboxSessionRegistry({ baseDir });
    const { api, handlers } = createFakeApi();
    // biome-ignore lint/suspicious/noExplicitAny: narrow fake API for test only.
    installSandboxLifecycle(api as any, { registry });
    const start = handlers.get("session_start");

    // when
    // biome-ignore lint/suspicious/noExplicitAny: test-only event object.
    await start?.({} as any, createFakeCtx("session-A"));

    // then
    expect(registry.has("session-A")).toBe(true);
    const session = await registry.acquire("session-A");
    expect(existsSync(session.getRoot())).toBe(true);
  });

  it("session_shutdown handler cleans up the current session's sandbox root", async () => {
    // given
    const registry = new SandboxSessionRegistry({ baseDir });
    const { api, handlers } = createFakeApi();
    // biome-ignore lint/suspicious/noExplicitAny: narrow fake API for test only.
    installSandboxLifecycle(api as any, { registry });
    const start = handlers.get("session_start");
    const shutdown = handlers.get("session_shutdown");
    const ctx = createFakeCtx("session-S");
    // biome-ignore lint/suspicious/noExplicitAny: test-only event object.
    await start?.({} as any, ctx as any);
    const rootBefore = (await registry.acquire("session-S")).getRoot();

    // when
    // biome-ignore lint/suspicious/noExplicitAny: test-only event object.
    await shutdown?.({} as any, ctx as any);

    // then
    expect(existsSync(rootBefore)).toBe(false);
    expect(registry.has("session-S")).toBe(false);
  });

  it("session_before_switch handler cleans up the outgoing session", async () => {
    // given
    const registry = new SandboxSessionRegistry({ baseDir });
    const { api, handlers } = createFakeApi();
    // biome-ignore lint/suspicious/noExplicitAny: narrow fake API for test only.
    installSandboxLifecycle(api as any, { registry });
    const start = handlers.get("session_start");
    const beforeSwitch = handlers.get("session_before_switch");
    const ctx = createFakeCtx("session-out");
    // biome-ignore lint/suspicious/noExplicitAny: test-only event object.
    await start?.({} as any, ctx as any);
    const rootBefore = (await registry.acquire("session-out")).getRoot();

    // when
    // biome-ignore lint/suspicious/noExplicitAny: test-only event object.
    await beforeSwitch?.({} as any, ctx as any);

    // then
    expect(existsSync(rootBefore)).toBe(false);
    expect(registry.has("session-out")).toBe(false);
  });

  it("session_before_fork handler cleans up the current session before a fork", async () => {
    // given
    const registry = new SandboxSessionRegistry({ baseDir });
    const { api, handlers } = createFakeApi();
    // biome-ignore lint/suspicious/noExplicitAny: narrow fake API for test only.
    installSandboxLifecycle(api as any, { registry });
    const start = handlers.get("session_start");
    const beforeFork = handlers.get("session_before_fork");
    const ctx = createFakeCtx("session-fork");
    // biome-ignore lint/suspicious/noExplicitAny: test-only event object.
    await start?.({} as any, ctx as any);
    const rootBefore = (await registry.acquire("session-fork")).getRoot();

    // when
    // biome-ignore lint/suspicious/noExplicitAny: test-only event object.
    await beforeFork?.({} as any, ctx as any);

    // then
    expect(existsSync(rootBefore)).toBe(false);
  });
});

describe("installSandboxLifecycle signal handlers", () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-justbash-test-")));
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it("reapAllSessions() cleans every registered sandbox", async () => {
    // given
    const registry = new SandboxSessionRegistry({ baseDir });
    const { api } = createFakeApi();
    // biome-ignore lint/suspicious/noExplicitAny: narrow fake API for test only.
    const handle = installSandboxLifecycle(api as any, { registry });
    const rootA = (await registry.acquire("a")).getRoot();
    const rootB = (await registry.acquire("b")).getRoot();

    // when
    await handle.reapAllSessions();

    // then
    expect(existsSync(rootA)).toBe(false);
    expect(existsSync(rootB)).toBe(false);
    expect(registry.size()).toBe(0);
  });
});

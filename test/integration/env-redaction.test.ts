import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import createJustBashExtension from "../../src/index.js";

// biome-ignore lint/suspicious/noExplicitAny: test-only fake ExtensionAPI.
type AnyHandler = (event: any, ctx: any) => any;

function createFakeApi(sandboxRoot: string, extraFlags?: Record<string, string>) {
  const registered = new Map<
    string,
    {
      name: string;
      execute: (
        toolCallId: string,
        params: unknown,
        signal: AbortSignal | undefined,
        onUpdate: unknown,
        // biome-ignore lint/suspicious/noExplicitAny: test-only fake ctx.
        ctx: any,
      ) => Promise<unknown>;
    }
  >();
  const handlers = new Map<string, AnyHandler>();
  const flagValues = new Map<string, boolean | string | undefined>([
    ["sandbox-root", sandboxRoot],
    ...Object.entries(extraFlags ?? {}),
  ]);
  const api = {
    // biome-ignore lint/suspicious/noExplicitAny: test-only fake.
    registerTool: (tool: any) => {
      registered.set(tool.name, tool);
    },
    on: (event: string, handler: AnyHandler) => {
      handlers.set(event, handler);
    },
    registerFlag: () => {},
    getFlag: (name: string) => flagValues.get(name),
  };
  return { api, registered, handlers };
}

async function withEnv<T>(
  vars: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const previous: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(vars)) {
    previous[name] = process.env[name];
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
  try {
    return await fn();
  } finally {
    for (const [name, prev] of Object.entries(previous)) {
      if (prev === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = prev;
      }
    }
  }
}

function flattenText(result: unknown): string {
  const content = (result as { content?: unknown[] } | undefined)?.content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (c): c is { type: string; text?: string } =>
        c !== null && typeof c === "object" && (c as { type?: string }).type === "text",
    )
    .map((c) => c.text ?? "")
    .join("\n");
}

describe("sandbox redacts host env values across bash / read / write / edit", () => {
  let sandboxBase: string;
  const secret = "sk-fake-anthropic-very-long-secret-value";

  beforeEach(() => {
    sandboxBase = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-justbash-redact-")));
  });

  afterEach(() => {
    rmSync(sandboxBase, { recursive: true, force: true });
  });

  it("bash tool redacts a secret value printed via echo", async () => {
    await withEnv({ ANTHROPIC_API_KEY: secret }, async () => {
      // given
      const { api, registered, handlers } = createFakeApi(sandboxBase);
      // biome-ignore lint/suspicious/noExplicitAny: test-only fake ExtensionAPI.
      await createJustBashExtension(api as any);
      const start = handlers.get("session_start");
      const ctx = { sessionManager: { getSessionId: () => "ses-redact-bash" } };
      // biome-ignore lint/suspicious/noExplicitAny: test-only event object.
      await start?.({} as any, ctx as any);
      const bash = registered.get("bash");
      if (bash === undefined) throw new Error("bash tool not registered");

      // when
      const result = await bash.execute(
        "call-redact-bash",
        { command: `echo "leak=${secret} end"` },
        undefined,
        undefined,
        ctx,
      );

      // then
      const text = flattenText(result);
      expect(text).not.toContain(secret);
      expect(text).toContain("[REDACTED]");
    });
  });

  it("read tool returns redacted content for a file containing a secret", async () => {
    await withEnv({ ANTHROPIC_API_KEY: secret }, async () => {
      // given
      const { api, registered, handlers } = createFakeApi(sandboxBase);
      // biome-ignore lint/suspicious/noExplicitAny: test-only fake ExtensionAPI.
      await createJustBashExtension(api as any);
      const start = handlers.get("session_start");
      const ctx = { sessionManager: { getSessionId: () => "ses-redact-read" } };
      // biome-ignore lint/suspicious/noExplicitAny: test-only event object.
      await start?.({} as any, ctx as any);
      const fs = await import("node:fs/promises");
      const dirents = (await import("node:fs")).readdirSync(sandboxBase);
      const sessDir = dirents.find((n) => n.startsWith("sess-ses-redact-read-"));
      if (sessDir === undefined) throw new Error("session dir missing");
      const root = path.join(sandboxBase, sessDir);
      const target = path.join(root, "cfg.txt");
      await fs.writeFile(target, `secret=${secret}\n`);
      const read = registered.get("read");
      if (read === undefined) throw new Error("read tool not registered");

      // when
      const result = await read.execute(
        "call-redact-read",
        { path: target },
        undefined,
        undefined,
        ctx,
      );

      // then
      const text = flattenText(result);
      expect(text).not.toContain(secret);
      expect(text).toContain("[REDACTED]");
    });
  });

  it("write tool refuses to land secret bytes on disk", async () => {
    await withEnv({ ANTHROPIC_API_KEY: secret }, async () => {
      // given
      const { api, registered, handlers } = createFakeApi(sandboxBase);
      // biome-ignore lint/suspicious/noExplicitAny: test-only fake ExtensionAPI.
      await createJustBashExtension(api as any);
      const start = handlers.get("session_start");
      const ctx = { sessionManager: { getSessionId: () => "ses-redact-write" } };
      // biome-ignore lint/suspicious/noExplicitAny: test-only event object.
      await start?.({} as any, ctx as any);
      const dirents = (await import("node:fs")).readdirSync(sandboxBase);
      const sessDir = dirents.find((n) => n.startsWith("sess-ses-redact-write-"));
      if (sessDir === undefined) throw new Error("session dir missing");
      const root = path.join(sandboxBase, sessDir);
      const target = path.join(root, "leak.txt");
      const write = registered.get("write");
      if (write === undefined) throw new Error("write tool not registered");

      // when
      await write.execute(
        "call-redact-write",
        { path: target, content: `payload=${secret}` },
        undefined,
        undefined,
        ctx,
      );

      // then
      const onDisk = readFileSync(target, "utf8");
      expect(onDisk).not.toContain(secret);
      expect(onDisk).toContain("[REDACTED]");
    });
  });

  it("opt-out via SANDBOX_REDACT_ENV=false disables redaction", async () => {
    await withEnv({ ANTHROPIC_API_KEY: secret, SANDBOX_REDACT_ENV: "false" }, async () => {
      // given
      const { api, registered, handlers } = createFakeApi(sandboxBase);
      // biome-ignore lint/suspicious/noExplicitAny: test-only fake ExtensionAPI.
      await createJustBashExtension(api as any);
      const start = handlers.get("session_start");
      const ctx = { sessionManager: { getSessionId: () => "ses-noredact" } };
      // biome-ignore lint/suspicious/noExplicitAny: test-only event object.
      await start?.({} as any, ctx as any);
      const bash = registered.get("bash");
      if (bash === undefined) throw new Error("bash tool not registered");

      // when
      const result = await bash.execute(
        "call-noredact",
        { command: `echo "value=${secret}"` },
        undefined,
        undefined,
        ctx,
      );

      // then
      const text = flattenText(result);
      expect(text).toContain(secret);
    });
  });

  it("custom marker via SANDBOX_REDACTION_MARKER flows through", async () => {
    await withEnv(
      { ANTHROPIC_API_KEY: secret, SANDBOX_REDACTION_MARKER: "<<HIDDEN>>" },
      async () => {
        // given
        const { api, registered, handlers } = createFakeApi(sandboxBase);
        // biome-ignore lint/suspicious/noExplicitAny: test-only fake ExtensionAPI.
        await createJustBashExtension(api as any);
        const start = handlers.get("session_start");
        const ctx = { sessionManager: { getSessionId: () => "ses-marker" } };
        // biome-ignore lint/suspicious/noExplicitAny: test-only event object.
        await start?.({} as any, ctx as any);
        const bash = registered.get("bash");
        if (bash === undefined) throw new Error("bash tool not registered");

        // when
        const result = await bash.execute(
          "call-marker",
          { command: `echo "value=${secret}"` },
          undefined,
          undefined,
          ctx,
        );

        // then
        const text = flattenText(result);
        expect(text).toContain("<<HIDDEN>>");
        expect(text).not.toContain(secret);
      },
    );
  });
});

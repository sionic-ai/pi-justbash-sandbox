import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import createJustBashExtension from "../../src/index.js";

// biome-ignore lint/suspicious/noExplicitAny: fake ExtensionAPI for integration tests.
type AnyHandler = (event: any, ctx: any) => any;

interface FakeApiHandle {
  // biome-ignore lint/suspicious/noExplicitAny: test-only fake.
  api: any;
  tools: Map<
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
  >;
  handlers: Map<string, AnyHandler>;
}

function createFakeApi(sandboxRoot: string): FakeApiHandle {
  const tools: FakeApiHandle["tools"] = new Map();
  const handlers = new Map<string, AnyHandler>();
  const flagValues = new Map<string, boolean | string | undefined>([["sandbox-root", sandboxRoot]]);
  const api = {
    // biome-ignore lint/suspicious/noExplicitAny: test-only fake.
    registerTool: (tool: any) => {
      tools.set(tool.name, tool);
    },
    on: (event: string, handler: AnyHandler) => {
      handlers.set(event, handler);
    },
    registerFlag: () => {},
    getFlag: (name: string) => flagValues.get(name),
  };
  return { api, tools, handlers };
}

async function bootExtensionForSession(sandboxRoot: string, sessionId: string) {
  const handle = createFakeApi(sandboxRoot);
  await createJustBashExtension(handle.api);
  const start = handle.handlers.get("session_start");
  const ctx = { sessionManager: { getSessionId: () => sessionId } };
  // biome-ignore lint/suspicious/noExplicitAny: test-only event object.
  await start?.({} as any, ctx as any);
  // The sandbox root lives under sandboxRoot as `sess-<id>-<hex16>`.
  const entries = await import("node:fs").then((m) =>
    m.readdirSync(sandboxRoot).filter((n) => n.startsWith(`sess-${sessionId}-`)),
  );
  const first = entries[0];
  if (first === undefined) {
    throw new Error(`sandbox root for ${sessionId} not found under ${sandboxRoot}`);
  }
  const root = path.join(sandboxRoot, first);
  return { ...handle, ctx, root };
}

describe("extension tool_call integration", () => {
  let sandboxBase: string;

  beforeEach(() => {
    sandboxBase = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-justbash-test-")));
  });

  afterEach(() => {
    rmSync(sandboxBase, { recursive: true, force: true });
  });

  it("bash tool runs commands inside the sandbox and cannot see host-only files", async () => {
    // given
    const outsideFile = path.join(sandboxBase, "outside.txt");
    await import("node:fs/promises").then((m) => m.writeFile(outsideFile, "host-only", "utf8"));
    const { tools, ctx, root } = await bootExtensionForSession(sandboxBase, "ses-bash");
    const bash = tools.get("bash");
    expect(bash).toBeDefined();
    const chunks: string[] = [];

    // when
    const result = (await bash!.execute(
      "call-bash",
      { command: "ls /" },
      undefined,
      // biome-ignore lint/suspicious/noExplicitAny: onUpdate signature doesn't match here; we collect through bash's own streaming.
      ((partial: any) => {
        for (const c of partial?.content ?? []) {
          if (c && typeof c === "object" && c.type === "text" && typeof c.text === "string") {
            chunks.push(c.text);
          }
        }
      }) as any,
      ctx,
    )) as { content: { type: string; text?: string }[] };

    // then — bash saw only the (empty) sandbox root, never the outside file.
    const textOut = (result.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n");
    expect(textOut + chunks.join("")).not.toContain("outside.txt");
    expect(existsSync(root)).toBe(true);
  });

  it("write + read tools round-trip inside the sandbox root", async () => {
    // given
    const { tools, ctx, root } = await bootExtensionForSession(sandboxBase, "ses-rw");
    const write = tools.get("write");
    const read = tools.get("read");
    expect(write).toBeDefined();
    expect(read).toBeDefined();
    const target = path.join(root, "note.txt");

    // when
    await write!.execute(
      "call-write",
      { path: target, content: "hello pi" },
      undefined,
      undefined,
      ctx,
    );
    const readResult = (await read!.execute(
      "call-read",
      { path: target },
      undefined,
      undefined,
      ctx,
    )) as { content: { type: string; text?: string }[] };

    // then — the file exists on disk inside the sandbox, and read returns it.
    expect(existsSync(target)).toBe(true);
    expect(readFileSync(target, "utf8")).toBe("hello pi");
    const joined = (readResult.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n");
    expect(joined).toContain("hello pi");
  });

  it("write tool refuses to write outside the sandbox", async () => {
    // given
    const { tools, ctx } = await bootExtensionForSession(sandboxBase, "ses-escape");
    const write = tools.get("write");
    expect(write).toBeDefined();
    const outside = path.join(path.dirname(sandboxBase), "host-owned.txt");

    // when
    const result = (await write!
      .execute("call-escape", { path: outside, content: "bad" }, undefined, undefined, ctx)
      .catch((e: unknown) => ({ threw: e }))) as unknown;

    // then — either the tool returned an error result or it threw; in
    // both cases the outside file must not exist.
    expect(existsSync(outside)).toBe(false);
    // Tolerate both shapes: pi's WriteAdapter may surface as a thrown
    // error (preferred) or an isError tool result.
    if (
      result !== null &&
      typeof result === "object" &&
      "threw" in (result as Record<string, unknown>)
    ) {
      expect((result as { threw: unknown }).threw).toBeDefined();
    }
  });

  it("grep tool short-circuits with a sandbox notice", async () => {
    // given
    const { tools, ctx } = await bootExtensionForSession(sandboxBase, "ses-grep");
    const grep = tools.get("grep");
    expect(grep).toBeDefined();

    // when / then
    await expect(
      grep!.execute("call-grep", { pattern: "anything" }, undefined, undefined, ctx),
    ).rejects.toThrow(/sandbox/i);
  });
});

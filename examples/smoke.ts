/**
 * Smoke test for @sionic-ai/pi-justbash-sandbox.
 *
 * Runs the extension factory against a minimal in-memory ExtensionAPI,
 * drives a couple of tool calls through the resulting sandbox tools, and
 * prints a checklist so you can sanity-check the install locally.
 *
 * Usage:
 *   pnpm tsx examples/smoke.ts
 *   bun run examples/smoke.ts
 *
 * No network, no pi session file, no external services.
 */

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import createJustBashExtension from "../src/index.js";

type ToolDef = {
  name: string;
  execute: (
    toolCallId: string,
    params: unknown,
    signal: AbortSignal | undefined,
    onUpdate: unknown,
    ctx: unknown,
  ) => Promise<unknown>;
};

async function main(): Promise<void> {
  const sandboxBase = mkdtempSync(path.join(tmpdir(), "pi-justbash-smoke-"));
  const tools = new Map<string, ToolDef>();
  const handlers = new Map<string, (event: unknown, ctx: unknown) => unknown>();

  const api = {
    registerTool: (tool: ToolDef) => {
      tools.set(tool.name, tool);
    },
    on: (event: string, handler: (event: unknown, ctx: unknown) => unknown) => {
      handlers.set(event, handler);
    },
    registerFlag: () => {},
    getFlag: (name: string) => (name === "sandbox-root" ? sandboxBase : undefined),
  };

  await createJustBashExtension(api as never);

  const ctx = { sessionManager: { getSessionId: () => "smoke" } };
  await handlers.get("session_start")?.({}, ctx);

  const bash = tools.get("bash");
  const write = tools.get("write");
  const read = tools.get("read");
  const grep = tools.get("grep");
  if (!bash || !write || !read || !grep) {
    throw new Error("expected bash/write/read/grep to be registered");
  }

  const entries = await import("node:fs").then((m) =>
    m.readdirSync(sandboxBase).filter((n) => n.startsWith("sess-smoke-")),
  );
  if (entries.length !== 1) {
    throw new Error(`expected a single sandbox root, found ${entries.length}`);
  }
  const entryName = entries[0];
  if (typeof entryName !== "string") {
    throw new Error("sandbox root entry name was not a string");
  }
  const root = path.join(sandboxBase, entryName);

  // 1) write a file via the sandboxed write tool.
  const target = path.join(root, "hello.txt");
  await write.execute(
    "smoke-write",
    { path: target, content: "hello from pi-justbash-sandbox\n" },
    undefined,
    undefined,
    ctx,
  );

  // 2) read it back.
  const readResult = (await read.execute(
    "smoke-read",
    { path: target },
    undefined,
    undefined,
    ctx,
  )) as { content: { type: string; text?: string }[] };
  const readText = (readResult.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n");

  // 3) exercise bash inside the sandbox.
  const bashChunks: string[] = [];
  await bash.execute(
    "smoke-bash",
    { command: "echo sandboxed; ls" },
    undefined,
    (partial: unknown) => {
      const content = (partial as { content?: unknown[] } | undefined)?.content;
      if (!Array.isArray(content)) {
        return;
      }
      for (const c of content) {
        if (c && typeof c === "object" && (c as { type?: string }).type === "text") {
          const text = (c as { text?: unknown }).text;
          if (typeof text === "string") {
            bashChunks.push(text);
          }
        }
      }
    },
    ctx,
  );

  // 4) confirm grep is blocked.
  let grepBlocked = false;
  try {
    await grep.execute("smoke-grep", { pattern: "x" }, undefined, undefined, ctx);
  } catch {
    grepBlocked = true;
  }

  // Teardown.
  await handlers.get("session_shutdown")?.({}, ctx);

  const rows = [
    { name: "sandbox root created", ok: existsSync(sandboxBase) },
    {
      name: "write adapter persisted bytes",
      ok: readText.includes("hello from pi-justbash-sandbox"),
    },
    { name: "bash adapter streamed output", ok: bashChunks.join("").includes("sandboxed") },
    { name: "grep tool blocked", ok: grepBlocked },
    { name: "session shutdown removed root", ok: !existsSync(root) },
  ];
  const ok = rows.every((r) => r.ok);

  for (const r of rows) {
    process.stdout.write(`${r.ok ? "OK " : "FAIL"}  ${r.name}\n`);
  }

  rmSync(sandboxBase, { recursive: true, force: true });

  if (!ok) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  process.stderr.write(`${String(err)}\n`);
  process.exitCode = 1;
});

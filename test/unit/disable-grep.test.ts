import { describe, expect, it } from "vitest";
import { buildDisableGrepTool, buildGrepToolCallBlocker } from "../../src/tools/disable-grep.js";

describe("buildDisableGrepTool", () => {
  it("has name 'grep' so it shadows the built-in", () => {
    // given
    const tool = buildDisableGrepTool();

    // when
    const name = tool.name;

    // then
    expect(name).toBe("grep");
  });

  it("execute() throws a sandbox notice so pi's runtime marks it as an error", async () => {
    // given
    const tool = buildDisableGrepTool();

    // when / then
    await expect(
      tool.execute(
        "call-1",
        { pattern: "whatever", path: "." },
        undefined,
        undefined,
        // biome-ignore lint/suspicious/noExplicitAny: test-only fake ExtensionContext.
        {} as any,
      ),
    ).rejects.toThrow(/grep.*sandbox|sandbox.*grep/i);
  });
});

describe("buildGrepToolCallBlocker", () => {
  it("blocks grep tool_call events with a reason", async () => {
    // given
    const blocker = buildGrepToolCallBlocker();
    const event = {
      type: "tool_call" as const,
      toolCallId: "call-1",
      toolName: "grep" as const,
      input: { pattern: "x", path: "." },
    };

    // when
    // biome-ignore lint/suspicious/noExplicitAny: test-only fake ExtensionContext.
    const result = await blocker(event as any, {} as any);

    // then
    expect(result).toBeDefined();
    expect(result?.block).toBe(true);
    expect(result?.reason).toMatch(/grep/i);
    expect(result?.reason).toMatch(/sandbox/i);
  });

  it("passes through non-grep tool_call events (returns undefined)", async () => {
    // given
    const blocker = buildGrepToolCallBlocker();
    const event = {
      type: "tool_call" as const,
      toolCallId: "call-2",
      toolName: "bash" as const,
      input: { command: "echo hi" },
    };

    // when
    // biome-ignore lint/suspicious/noExplicitAny: test-only fake ExtensionContext.
    const result = await blocker(event as any, {} as any);

    // then
    expect(result).toBeUndefined();
  });
});

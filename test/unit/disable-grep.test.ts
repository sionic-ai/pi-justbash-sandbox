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

  it("execute() returns an error result with a sandbox notice", async () => {
    // given
    const tool = buildDisableGrepTool();

    // when
    const result = await tool.execute(
      "call-1",
      { pattern: "whatever", path: "." },
      undefined,
      undefined,
      // biome-ignore lint/suspicious/noExplicitAny: test-only fake ExtensionContext.
      {} as any,
    );

    // then
    expect(result.isError).toBe(true);
    const flat = JSON.stringify(result);
    expect(flat).toMatch(/grep/i);
    expect(flat).toMatch(/sandbox/i);
  });
});

describe("buildGrepToolCallBlocker", () => {
  it("blocks grep tool_call events with a reason", () => {
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
    const result = blocker(event as any, {} as any);

    // then
    expect(result).toBeDefined();
    expect(result?.block).toBe(true);
    expect(result?.reason).toMatch(/grep/i);
    expect(result?.reason).toMatch(/sandbox/i);
  });

  it("passes through non-grep tool_call events (returns undefined)", () => {
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
    const result = blocker(event as any, {} as any);

    // then
    expect(result).toBeUndefined();
  });
});

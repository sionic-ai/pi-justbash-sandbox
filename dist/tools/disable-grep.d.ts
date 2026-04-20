import type { ExtensionHandler, ToolCallEvent, ToolCallEventResult, ToolDefinition } from "@mariozechner/pi-coding-agent";
/**
 * Build a stub `grep` {@link ToolDefinition} that short-circuits with
 * an error result. Registering this on an {@link ExtensionAPI} shadows
 * pi-mono's built-in grep because pi's tool map uses first-registration-
 * wins semantics per tool name.
 */
export declare function buildDisableGrepTool(): ToolDefinition;
/**
 * Build a `tool_call` {@link ExtensionHandler} that hard-blocks grep.
 * Returned as `{ block: true, reason }` for grep and `undefined` for
 * every other tool so the rest of the toolchain keeps flowing. This is
 * the second layer of RESEARCH.md's defense-in-depth plan: even if some
 * other extension registered a grep tool before ours loaded, the
 * tool_call phase still refuses to invoke it.
 */
export declare function buildGrepToolCallBlocker(): ExtensionHandler<ToolCallEvent, ToolCallEventResult>;
//# sourceMappingURL=disable-grep.d.ts.map
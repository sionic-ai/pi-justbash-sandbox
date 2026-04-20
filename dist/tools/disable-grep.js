import { Type } from "@sinclair/typebox";
const DISABLED_MESSAGE = "grep is disabled by @sionic-ai/pi-justbash-sandbox; use `bash grep ...` inside the sandbox instead";
/**
 * Build a stub `grep` {@link ToolDefinition} that short-circuits with
 * an error result. Registering this on an {@link ExtensionAPI} shadows
 * pi-mono's built-in grep because pi's tool map uses first-registration-
 * wins semantics per tool name.
 */
export function buildDisableGrepTool() {
    // biome-ignore lint/suspicious/noExplicitAny: typebox schema Type constraint requires cast
    return {
        name: "grep",
        label: "grep (disabled)",
        description: "grep is disabled inside pi-justbash-sandbox. Shell out via `bash grep ...` to search within the sandbox.",
        parameters: Type.Object({
            pattern: Type.String(),
            path: Type.Optional(Type.String()),
            glob: Type.Optional(Type.String()),
            ignoreCase: Type.Optional(Type.Boolean()),
            literal: Type.Optional(Type.Boolean()),
            context: Type.Optional(Type.Number()),
            limit: Type.Optional(Type.Number()),
        }),
        async execute() {
            throw new Error(DISABLED_MESSAGE);
        },
    };
}
/**
 * Build a `tool_call` {@link ExtensionHandler} that hard-blocks grep.
 * Returned as `{ block: true, reason }` for grep and `undefined` for
 * every other tool so the rest of the toolchain keeps flowing. This is
 * the second layer of RESEARCH.md's defense-in-depth plan: even if some
 * other extension registered a grep tool before ours loaded, the
 * tool_call phase still refuses to invoke it.
 */
export function buildGrepToolCallBlocker() {
    return (event) => {
        if (event.toolName !== "grep") {
            return undefined;
        }
        return { block: true, reason: DISABLED_MESSAGE };
    };
}
//# sourceMappingURL=disable-grep.js.map
import { type ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { SandboxSession } from "../session/sandbox-session.js";
/**
 * Options for {@link registerSandboxTools}.
 */
export interface RegisterSandboxToolsOptions {
    /** An already-ensured {@link SandboxSession}. */
    readonly session: SandboxSession;
    /** Override the max file read size passed to the sandbox fs. */
    readonly maxFileReadSize?: number;
}
/**
 * Register the sandboxed replacements for the built-in pi-mono tools
 * (`bash`, `read`, `write`, `edit`) on the given {@link ExtensionAPI}.
 *
 * pi-mono's `ExtensionRunner` applies a first-registration-wins rule per
 * tool name, so calling this during extension factory initialization
 * shadows the host-touching defaults with sandbox-bound equivalents.
 */
export declare function registerSandboxTools(api: ExtensionAPI, options: RegisterSandboxToolsOptions): void;
//# sourceMappingURL=register-tools.d.ts.map
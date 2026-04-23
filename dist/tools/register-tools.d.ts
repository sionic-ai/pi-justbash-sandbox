import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { Command, NetworkConfig } from "just-bash";
import { Redactor } from "../security/redactor.js";
import type { SecretEnvClassifierOptions } from "../security/secret-env.js";
import type { SandboxSession } from "../session/sandbox-session.js";
import type { ToolFactories } from "./tool-factories.js";
/**
 * Options for {@link registerSandboxTools}.
 */
export interface RegisterSandboxToolsOptions {
    /** An already-ensured {@link SandboxSession}. */
    readonly session: SandboxSession;
    /** Override the max file read size passed to the sandbox fs. */
    readonly maxFileReadSize?: number;
    /**
     * Host-specific `create{Bash,Read,Write,Edit}ToolDefinition` factories.
     *
     * Provided by the active entry file (`entry-pi.ts` or
     * `entry-senpi.ts`) so this module carries no hard import of either
     * host package. Only the `ExtensionAPI` type comes from
     * `@mariozechner/pi-coding-agent` and is erased at runtime.
     */
    readonly factories: ToolFactories;
    /**
     * just-bash command definitions bridging host binaries (e.g. `storm`,
     * `carrier-lint`) into the sandboxed shell. When present, every
     * BashAdapter invocation exposes these names inside its virtual shell.
     */
    readonly hostBinaryBridges?: readonly Command[];
    /** Network policy forwarded to just-bash for curl/html fetch tools. */
    readonly network?: NetworkConfig;
    /**
     * Shared {@link Redactor} passed to every adapter so host env values
     * are scrubbed from bash output, file reads / writes, and host binary
     * bridges. Omit to opt out of redaction entirely.
     */
    readonly redactor?: Redactor;
    /**
     * When true, {@link BashAdapter} strips secret env entries from the
     * shell it constructs so the agent cannot expand `$SECRET` inline
     * (defense in depth on top of output redaction). Forwarded unchanged
     * to {@link BashAdapter.stripSecretEnvFromShell}.
     */
    readonly stripSecretEnvFromShell?: boolean;
    /**
     * Classifier allow / deny overrides propagated to every adapter that
     * classifies env names (bash shell strip, host bridge env strip).
     */
    readonly classifierOptions?: SecretEnvClassifierOptions;
}
/**
 * Register the sandboxed replacements for the built-in pi-mono tools
 * (`bash`, `read`, `write`, `edit`) on the given {@link ExtensionAPI}.
 *
 * pi-mono's `ExtensionRunner` applies a first-registration-wins rule per
 * tool name, so calling this during extension factory initialization
 * shadows the host-touching defaults with sandbox-bound equivalents.
 *
 * @see ToolFactories
 */
export declare function registerSandboxTools(api: ExtensionAPI, options: RegisterSandboxToolsOptions): void;
//# sourceMappingURL=register-tools.d.ts.map
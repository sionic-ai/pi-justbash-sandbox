import type { BashOperations } from "@mariozechner/pi-coding-agent";
import { type Command, type IFileSystem, type NetworkConfig } from "just-bash";
import { Redactor } from "../security/redactor.js";
import { type SecretEnvClassifierOptions } from "../security/secret-env.js";
/**
 * Construction parameters for {@link BashAdapter}.
 */
export interface BashAdapterOptions {
    /** The sandbox filesystem (`ReadWriteFs({ root, allowSymlinks: false })`). */
    readonly fs: IFileSystem;
    /** Host-absolute sandbox root (used to translate host cwds to virtual paths). */
    readonly root: string;
    /**
     * Extra just-bash command definitions to register on every shell
     * instance. Callers use this to expose host binaries (e.g. `storm`,
     * `carrier-lint`) into the sandboxed shell; see
     * {@link ../adapters/host-binary-bridge.ts}.
     */
    readonly customCommands?: readonly Command[];
    /** just-bash network policy for curl/html fetch commands. */
    readonly network?: NetworkConfig;
    /**
     * Redactor applied to stdout / stderr chunks before they reach pi's
     * `onData` callback. Prevents host env-var values (API keys, tokens)
     * from leaking to the agent via `env` / `printenv` / process output.
     * Defaults to {@link Redactor.noop}.
     */
    readonly redactor?: Redactor;
    /**
     * When true, secret-classified entries are stripped from the shell
     * env before the `Bash` instance is constructed. The agent then
     * literally cannot `echo $ANTHROPIC_API_KEY` - output redaction only
     * hides values; stripping prevents the agent from USING the secret
     * in outbound calls (e.g. curl with Authorization header). Default
     * false so existing behaviour is preserved unless the extension
     * factory opts in.
     */
    readonly stripSecretEnvFromShell?: boolean;
    /**
     * Classifier allow / deny overrides applied when
     * {@link BashAdapterOptions.stripSecretEnvFromShell} is true. Must
     * match the overrides used by {@link Redactor.fromEnv} so the agent
     * sees a consistent classification across strip and redact paths.
     */
    readonly classifierOptions?: SecretEnvClassifierOptions;
}
/**
 * pi-mono {@link BashOperations} implementation that runs every command
 * inside a fresh `just-bash` `Bash` instance scoped to the sandbox
 * filesystem. Each `exec()` builds its own Bash so per-call options
 * (cwd, env, signal) cannot leak between invocations.
 */
export declare class BashAdapter implements BashOperations {
    #private;
    constructor(options: BashAdapterOptions);
    exec(command: string, cwd: string, options: {
        onData: (data: Buffer) => void;
        signal?: AbortSignal;
        timeout?: number;
        env?: NodeJS.ProcessEnv;
    }): Promise<{
        exitCode: number | null;
    }>;
}
//# sourceMappingURL=bash-adapter.d.ts.map
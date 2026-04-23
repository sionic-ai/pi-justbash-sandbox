import { Bash } from "just-bash";
import { toVirtualPath } from "../fs/sandbox-paths.js";
import { Redactor } from "../security/redactor.js";
import { isSecretEnvName } from "../security/secret-env.js";
/**
 * pi-mono {@link BashOperations} implementation that runs every command
 * inside a fresh `just-bash` `Bash` instance scoped to the sandbox
 * filesystem. Each `exec()` builds its own Bash so per-call options
 * (cwd, env, signal) cannot leak between invocations.
 */
export class BashAdapter {
    #fs;
    #root;
    #customCommands;
    #network;
    #redactor;
    #stripShellEnv;
    #classifierOptions;
    constructor(options) {
        this.#fs = options.fs;
        this.#root = options.root;
        this.#customCommands = options.customCommands ?? [];
        this.#network = options.network;
        this.#redactor = options.redactor ?? Redactor.noop();
        this.#stripShellEnv = options.stripSecretEnvFromShell === true;
        this.#classifierOptions = options.classifierOptions ?? {};
    }
    async exec(command, cwd, options) {
        const redactor = this.#redactor;
        const emit = (buf) => {
            options.onData(redactor.redactBuffer(buf));
        };
        let virtualCwd;
        try {
            virtualCwd = toVirtualPath(this.#root, cwd);
        }
        catch {
            emit(Buffer.from(`pi-justbash-sandbox: cwd ${JSON.stringify(cwd)} is outside the sandbox\n`));
            return { exitCode: 126 };
        }
        const env = toStringEnv(options.env);
        const shellEnv = this.#stripShellEnv && env !== undefined
            ? stripSecretEntries(env, this.#classifierOptions)
            : env;
        const bash = new Bash({
            fs: this.#fs,
            cwd: virtualCwd,
            ...(shellEnv !== undefined ? { env: shellEnv } : {}),
            ...(this.#network !== undefined ? { network: this.#network } : {}),
            ...(this.#customCommands.length > 0 ? { customCommands: [...this.#customCommands] } : {}),
        });
        const controller = new AbortController();
        const externalAbort = () => controller.abort(options.signal?.reason);
        if (options.signal !== undefined) {
            if (options.signal.aborted) {
                controller.abort(options.signal.reason);
            }
            else {
                options.signal.addEventListener("abort", externalAbort, { once: true });
            }
        }
        let timeoutFired = false;
        const timeoutHandle = options.timeout !== undefined && options.timeout > 0
            ? setTimeout(() => {
                timeoutFired = true;
                controller.abort(new Error(`pi-justbash-sandbox: command timed out after ${options.timeout}ms`));
            }, options.timeout)
            : undefined;
        try {
            const result = await bash.exec(command, { signal: controller.signal });
            if (result.stdout.length > 0) {
                emit(Buffer.from(result.stdout, "utf8"));
            }
            if (result.stderr.length > 0) {
                emit(Buffer.from(result.stderr, "utf8"));
            }
            if (controller.signal.aborted) {
                if (timeoutFired) {
                    emit(Buffer.from(`pi-justbash-sandbox: command timed out after ${options.timeout}ms\n`));
                    return { exitCode: 124 };
                }
                return { exitCode: 130 };
            }
            return { exitCode: result.exitCode };
        }
        finally {
            if (timeoutHandle !== undefined) {
                clearTimeout(timeoutHandle);
            }
            options.signal?.removeEventListener("abort", externalAbort);
        }
    }
}
function toStringEnv(env) {
    if (env === undefined) {
        return undefined;
    }
    const out = {};
    for (const [key, value] of Object.entries(env)) {
        if (typeof value === "string") {
            out[key] = value;
        }
    }
    return out;
}
function stripSecretEntries(env, classifierOptions) {
    const out = {};
    for (const [key, value] of Object.entries(env)) {
        if (isSecretEnvName(key, classifierOptions))
            continue;
        out[key] = value;
    }
    return out;
}
//# sourceMappingURL=bash-adapter.js.map
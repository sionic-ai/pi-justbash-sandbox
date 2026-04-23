import type { BashOperations } from "@mariozechner/pi-coding-agent";
import { Bash, type Command, type IFileSystem, type NetworkConfig } from "just-bash";
import { toVirtualPath } from "../fs/sandbox-paths.js";
import { Redactor } from "../security/redactor.js";

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
}

/**
 * pi-mono {@link BashOperations} implementation that runs every command
 * inside a fresh `just-bash` `Bash` instance scoped to the sandbox
 * filesystem. Each `exec()` builds its own Bash so per-call options
 * (cwd, env, signal) cannot leak between invocations.
 */
export class BashAdapter implements BashOperations {
  readonly #fs: IFileSystem;
  readonly #root: string;
  readonly #customCommands: readonly Command[];
  readonly #network: NetworkConfig | undefined;
  readonly #redactor: Redactor;

  constructor(options: BashAdapterOptions) {
    this.#fs = options.fs;
    this.#root = options.root;
    this.#customCommands = options.customCommands ?? [];
    this.#network = options.network;
    this.#redactor = options.redactor ?? Redactor.noop();
  }

  async exec(
    command: string,
    cwd: string,
    options: {
      onData: (data: Buffer) => void;
      signal?: AbortSignal;
      timeout?: number;
      env?: NodeJS.ProcessEnv;
    },
  ): Promise<{ exitCode: number | null }> {
    const redactor = this.#redactor;
    const emit = (buf: Buffer): void => {
      options.onData(redactor.redactBuffer(buf));
    };

    let virtualCwd: string;
    try {
      virtualCwd = toVirtualPath(this.#root, cwd);
    } catch {
      emit(Buffer.from(`pi-justbash-sandbox: cwd ${JSON.stringify(cwd)} is outside the sandbox\n`));
      return { exitCode: 126 };
    }

    const env = toStringEnv(options.env);
    const bash = new Bash({
      fs: this.#fs,
      cwd: virtualCwd,
      ...(env !== undefined ? { env } : {}),
      ...(this.#network !== undefined ? { network: this.#network } : {}),
      ...(this.#customCommands.length > 0 ? { customCommands: [...this.#customCommands] } : {}),
    });

    const controller = new AbortController();
    const externalAbort = () => controller.abort(options.signal?.reason);
    if (options.signal !== undefined) {
      if (options.signal.aborted) {
        controller.abort(options.signal.reason);
      } else {
        options.signal.addEventListener("abort", externalAbort, { once: true });
      }
    }

    let timeoutFired = false;
    const timeoutHandle =
      options.timeout !== undefined && options.timeout > 0
        ? setTimeout(() => {
            timeoutFired = true;
            controller.abort(
              new Error(`pi-justbash-sandbox: command timed out after ${options.timeout}ms`),
            );
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
    } finally {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }
      options.signal?.removeEventListener("abort", externalAbort);
    }
  }
}

function toStringEnv(env: NodeJS.ProcessEnv | undefined): Record<string, string> | undefined {
  if (env === undefined) {
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") {
      out[key] = value;
    }
  }
  return out;
}

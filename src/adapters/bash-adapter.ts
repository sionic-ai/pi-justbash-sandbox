import type { BashOperations } from "@mariozechner/pi-coding-agent";
import { Bash, type IFileSystem } from "just-bash";
import { toVirtualPath } from "../fs/sandbox-paths.js";

/**
 * Construction parameters for {@link BashAdapter}.
 */
export interface BashAdapterOptions {
  /** The sandbox filesystem (`ReadWriteFs({ root, allowSymlinks: false })`). */
  readonly fs: IFileSystem;
  /** Host-absolute sandbox root (used to translate host cwds to virtual paths). */
  readonly root: string;
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

  constructor(options: BashAdapterOptions) {
    this.#fs = options.fs;
    this.#root = options.root;
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
    let virtualCwd: string;
    try {
      virtualCwd = toVirtualPath(this.#root, cwd);
    } catch {
      options.onData(
        Buffer.from(`pi-justbash-sandbox: cwd ${JSON.stringify(cwd)} is outside the sandbox\n`),
      );
      return { exitCode: 126 };
    }

    const env = toStringEnv(options.env);
    const bash = new Bash({
      fs: this.#fs,
      cwd: virtualCwd,
      ...(env !== undefined ? { env } : {}),
    });

    const execOptions: Record<string, unknown> = {};
    if (options.signal !== undefined) {
      execOptions.signal = options.signal;
    }
    const result = await bash.exec(command, execOptions);

    if (result.stdout.length > 0) {
      options.onData(Buffer.from(result.stdout, "utf8"));
    }
    return { exitCode: result.exitCode };
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

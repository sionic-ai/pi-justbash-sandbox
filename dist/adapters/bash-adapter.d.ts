import type { BashOperations } from "@mariozechner/pi-coding-agent";
import { type IFileSystem } from "just-bash";
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
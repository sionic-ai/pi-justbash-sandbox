import type { Command } from "just-bash";
import { Redactor } from "../security/redactor.js";
/**
 * Construction parameters for {@link createHostBinaryBridges}.
 */
export interface HostBinaryBridgeOptions {
    /**
     * Comma-separated list of binary names exposed from the host into
     * just-bash. Each name must be resolvable on `process.env.PATH`;
     * unresolvable names are silently skipped so the sandbox keeps booting
     * even when an optional tool is missing.
     */
    readonly names: readonly string[];
    /**
     * Extra env var names to PASS THROUGH to the host binary despite
     * being classified secret (e.g. a `STORM_API_TOKEN` the host tool
     * actually needs). Matched case-insensitively. Anything not on this
     * list and classified secret is stripped from the child process env
     * so the binary cannot exfiltrate keys from the operator's shell.
     */
    readonly passThroughSecretEnv?: readonly string[];
    /**
     * Redactor applied to the host binary's stdout / stderr before it is
     * handed back to just-bash. Defaults to {@link Redactor.noop}.
     */
    readonly redactor?: Redactor;
}
/**
 * Build `just-bash` command definitions that bridge a whitelist of host
 * binaries (e.g. `storm`, `carrier-lint`) into the sandboxed shell.
 *
 * Each returned command:
 * - Spawns the real host binary via `node:child_process.spawn`.
 * - Inherits the caller's stdin buffer (just-bash passes pipe stdin via
 *   `ctx.stdin`) and streams stdout/stderr back through
 *   {@link CommandContext.write}.
 * - Uses the caller's virtual `cwd` directly; just-bash passes it through
 *   as the real host cwd for the spawned process so the tool sees the
 *   user's workspace.
 *
 * These bridges intentionally sit **outside** the `ReadWriteFs` gate: the
 * host binary talks directly to the real filesystem. That is the desired
 * behaviour when the operator explicitly opts in by listing the binary
 * via {@link HostBinaryBridgeOptions.names}. Do not add a bridge for a
 * tool whose filesystem access would compromise the sandbox.
 */
export declare function createHostBinaryBridges(options: HostBinaryBridgeOptions): Command[];
//# sourceMappingURL=host-binary-bridge.d.ts.map
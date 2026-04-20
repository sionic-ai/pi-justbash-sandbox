import { spawn } from "node:child_process";
import type { Command } from "just-bash";
import { defineCommand } from "just-bash";

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
export function createHostBinaryBridges(options: HostBinaryBridgeOptions): Command[] {
  const commands: Command[] = [];
  for (const rawName of options.names) {
    const name = rawName.trim();
    if (name.length === 0) continue;
    commands.push(buildBridgeCommand(name));
  }
  return commands;
}

function buildBridgeCommand(name: string): Command {
  return defineCommand(name, async (args, ctx) => {
    const cwd = typeof ctx.cwd === "string" && ctx.cwd.length > 0 ? ctx.cwd : "/";

    // just-bash passes env as Map<string, string>. Merge onto process.env so
    // the spawned host binary inherits PATH, HOME, etc. in addition to the
    // caller's overrides.
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const [key, value] of ctx.env) {
      env[key] = value;
    }

    const child = spawn(name, args, {
      cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout?.on("data", (data: Buffer) => stdoutChunks.push(data));
    child.stderr?.on("data", (data: Buffer) => stderrChunks.push(data));

    if (ctx.stdin.length > 0) {
      child.stdin?.write(ctx.stdin);
    }
    child.stdin?.end();

    const exitCode: number = await new Promise((resolve) => {
      child.once("error", () => resolve(127));
      child.once("close", (code) => resolve(code ?? 1));
    });

    return {
      stdout: Buffer.concat(stdoutChunks).toString("utf8"),
      stderr: Buffer.concat(stderrChunks).toString("utf8"),
      exitCode,
    };
  });
}

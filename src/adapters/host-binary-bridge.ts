import { spawn } from "node:child_process";
import type { Command } from "just-bash";
import { defineCommand } from "just-bash";
import { Redactor } from "../security/redactor.js";
import { isSecretEnvName, type SecretEnvClassifierOptions } from "../security/secret-env.js";

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
  /**
   * Classifier allow / deny overrides. Must match the overrides used
   * everywhere else in the extension so `--sandbox-redact-env-allow`
   * and `--sandbox-redact-env-deny` apply uniformly to bridge env
   * filtering as well.
   */
  readonly classifierOptions?: SecretEnvClassifierOptions;
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
  const passThrough = normalizePassThrough(options.passThroughSecretEnv);
  const redactor = options.redactor ?? Redactor.noop();
  const classifierOptions = options.classifierOptions ?? {};
  for (const rawName of options.names) {
    const name = rawName.trim();
    if (name.length === 0) continue;
    commands.push(buildBridgeCommand(name, passThrough, redactor, classifierOptions));
  }
  return commands;
}

export function normalizePassThrough(names?: readonly string[]): ReadonlySet<string> {
  return new Set((names ?? []).map((name) => name.trim().toUpperCase()));
}

export function buildHostBridgeEnv(
  processEnv: NodeJS.ProcessEnv | Record<string, string | undefined>,
  ctxEnv: Iterable<readonly [string, string]>,
  passThrough: ReadonlySet<string>,
  classifierOptions: SecretEnvClassifierOptions,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(processEnv)) {
    if (typeof value !== "string") continue;
    if (shouldStrip(key, passThrough, classifierOptions)) continue;
    out[key] = value;
  }
  for (const [key, value] of ctxEnv) {
    if (shouldStrip(key, passThrough, classifierOptions)) continue;
    out[key] = value;
  }
  return out;
}

function shouldStrip(
  name: string,
  passThrough: ReadonlySet<string>,
  classifierOptions: SecretEnvClassifierOptions,
): boolean {
  if (passThrough.has(name.toUpperCase())) return false;
  return isSecretEnvName(name, classifierOptions);
}

function buildBridgeCommand(
  name: string,
  passThrough: ReadonlySet<string>,
  redactor: Redactor,
  classifierOptions: SecretEnvClassifierOptions,
): Command {
  return defineCommand(name, async (args, ctx) => {
    const cwd = typeof ctx.cwd === "string" && ctx.cwd.length > 0 ? ctx.cwd : "/";

    const env = buildHostBridgeEnv(process.env, ctx.env, passThrough, classifierOptions);

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

    const stdout = Buffer.concat(stdoutChunks).toString("utf8");
    const stderr = Buffer.concat(stderrChunks).toString("utf8");
    return {
      stdout: redactor.isNoop() ? stdout : redactor.redact(stdout),
      stderr: redactor.isNoop() ? stderr : redactor.redact(stderr),
      exitCode,
    };
  });
}

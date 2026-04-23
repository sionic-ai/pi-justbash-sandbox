import { spawn } from "node:child_process";
import { defineCommand } from "just-bash";
import { Redactor } from "../security/redactor.js";
import { isSecretEnvName } from "../security/secret-env.js";
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
export function createHostBinaryBridges(options) {
    const commands = [];
    const passThrough = new Set((options.passThroughSecretEnv ?? []).map((name) => name.trim().toUpperCase()));
    const redactor = options.redactor ?? Redactor.noop();
    for (const rawName of options.names) {
        const name = rawName.trim();
        if (name.length === 0)
            continue;
        commands.push(buildBridgeCommand(name, passThrough, redactor));
    }
    return commands;
}
function shouldStrip(name, passThrough) {
    if (passThrough.has(name.toUpperCase()))
        return false;
    return isSecretEnvName(name);
}
function buildBridgeCommand(name, passThrough, redactor) {
    return defineCommand(name, async (args, ctx) => {
        const cwd = typeof ctx.cwd === "string" && ctx.cwd.length > 0 ? ctx.cwd : "/";
        const env = {};
        for (const [key, value] of Object.entries(process.env)) {
            if (typeof value !== "string")
                continue;
            if (shouldStrip(key, passThrough))
                continue;
            env[key] = value;
        }
        for (const [key, value] of ctx.env) {
            if (shouldStrip(key, passThrough))
                continue;
            env[key] = value;
        }
        const child = spawn(name, args, {
            cwd,
            env,
            stdio: ["pipe", "pipe", "pipe"],
        });
        const stdoutChunks = [];
        const stderrChunks = [];
        child.stdout?.on("data", (data) => stdoutChunks.push(data));
        child.stderr?.on("data", (data) => stderrChunks.push(data));
        if (ctx.stdin.length > 0) {
            child.stdin?.write(ctx.stdin);
        }
        child.stdin?.end();
        const exitCode = await new Promise((resolve) => {
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
//# sourceMappingURL=host-binary-bridge.js.map
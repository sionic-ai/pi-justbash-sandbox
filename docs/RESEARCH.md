# Research Notes — pi-justbash-sandbox

Captured 2026-04-20 (KST) from upstream `badlogic/pi-mono` and `vercel-labs/just-bash`.
All pin versions below are the ones actually inspected; treat them as the baseline to
integrate against, not a hard-coded requirement.

## 1. Scope of this project (MVP)

Build an npm-installable extension for pi-mono (`@mariozechner/pi-coding-agent`)
that — when loaded — replaces the default filesystem-touching tools with a
sandbox backed by `just-bash`.

Required behaviour for the MVP:

| Default pi tool | New behaviour |
|-----------------|---------------|
| `bash`          | Executed inside a `just-bash` `Bash` instance (sandboxed shell). |
| `read`          | Delegates to a sandboxed `ReadOperations` that reads through `ReadWriteFs`. |
| `write`         | Delegates to a sandboxed `WriteOperations` that writes through `ReadWriteFs`. |
| `edit`          | Delegates through the same `ReadWriteFs` (reuses read + write). |
| `grep`          | **Disabled.** The extension must unregister / block this tool. |
| `ls`, `find`    | Out of MVP scope — leave pi defaults unless a consumer opts in. |

Per-session filesystem isolation + cleanup is explicitly in scope:

- Each pi session gets its own sandbox root under a configurable base dir
  (default `os.tmpdir()/pi-justbash/<sessionId>`).
- Cleanup must fire on `session_shutdown`, `session_before_switch`,
  `session_before_fork`, and on process signals (SIGINT/SIGTERM/SIGHUP).
- Orphan reaper removes dirs older than N hours on startup.

**Out of scope for this repo (initial release):**
- `storm` / `storm-lint` custom commands (live in a separate Sionic repo).
- `sionic-task`, `sionic-todo`, `sionic-branding` extensions.
- Network allow-list policy beyond exposing just-bash's `NetworkConfig` hook.

## 2. pi-mono extension surface (verified in source)

Source inspected: `badlogic/pi-mono@main`,
`packages/coding-agent/src/core/**`, `examples/extensions/ssh.ts`,
`docs/extensions.md`.

### 2.1 Entry point

Extensions export a default factory:

```ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
export default function (pi: ExtensionAPI) { /* ... */ }
```

They are discovered from `.pi/extensions/`, `~/.pi/agent/extensions/`, or
listed explicitly in `settings.json` `extensions` / `packages` arrays
(see `docs/extensions.md`).

### 2.2 Tool replacement semantics — **confirmed**

- `ExtensionAPI.registerTool(tool)` inserts a tool into the extension's tool
  map (`packages/coding-agent/src/core/extensions/loader.ts:175`).
- `ExtensionRunner.getAllTools()` iterates extensions in load order and uses
  **first registration per tool name wins**
  (`packages/coding-agent/src/core/extensions/runner.ts:350-360`:
  `if (!toolsByName.has(tool.definition.name)) toolsByName.set(...)`).
- In `packages/coding-agent/src/core/sdk.ts` the SDK initialises the agent
  with `defaultActiveToolNames = ["read", "bash", "edit", "write"]`, and the
  session runtime merges extension tools on top. Registering `bash`,
  `read`, `write`, `edit` from the extension therefore **shadows the built-ins**.
- `grep` is listed in `allTools` but is not in the default active set; still,
  we must make sure it cannot be re-enabled by settings. The safe pattern is
  to register a `grep` tool that returns an error telling the caller "grep is
  disabled in the sandbox" and to not include `grep` in any default toolset
  we recommend.
- There is **no public `unregisterTool` / `replace: true` flag**. The pattern
  used by the official SSH example (`examples/extensions/ssh.ts`) is exactly
  "register a same-named tool that wraps an inner implementation"; we adopt
  the same pattern.

### 2.3 Factories we reuse from pi-coding-agent

Public exports (confirmed in `src/core/tools/index.ts` and re-exported via
`@mariozechner/pi-coding-agent` package `exports."."`):

- `createBashTool(cwd, { operations })`, `createBashToolDefinition(...)`
- `createReadTool(cwd, { operations })`, `createReadToolDefinition(...)`
- `createWriteTool(cwd, { operations })`, `createWriteToolDefinition(...)`
- `createEditTool(cwd, { operations })`, `createEditToolDefinition(...)`
- Operation interfaces: `BashOperations`, `ReadOperations`, `WriteOperations`,
  `EditOperations` (defined in `src/core/tools/bash.ts` et al).

`BashOperations.exec(command, cwd, { onData, signal, timeout })` is what we
must implement on top of `just-bash`.

### 2.4 Lifecycle hooks we care about

Confirmed in `docs/extensions.md` and `src/core/extensions/types.ts`:

- `session_start` { reason: "startup" | "new" | "resume" | "fork" | "reload", previousSessionFile? }
- `session_before_switch`, `session_before_fork` (can cancel)
- `session_shutdown` (exit, SIGINT/SIGTERM/SIGHUP)
- `tool_call` (can block / mutate input)
- `tool_result` (can modify result / mark error)

We bind bash/read/write/edit replacements at factory time and use
`session_start` / `session_shutdown` to create/tear down the per-session
sandbox root.

### 2.5 Commands / flags we expose

- `pi.registerFlag("sandbox-root", { type: "string" })` — override base dir.
- `pi.registerFlag("sandbox-allow-network", { type: "boolean", default: false })`.
- `pi.registerFlag("sandbox-max-file-size-mb", { type: "string" })` (parsed as int).
- `pi.registerCommand("sandbox:status", ...)` — print current session's
  sandbox root + usage to `ctx.ui.notify`.
- `pi.registerCommand("sandbox:reset", ...)` — wipe and recreate the
  current session's root (uses `ctx.waitForIdle`).

## 3. just-bash surface (verified against published tarball)

Source inspected: `just-bash@2.14.2` (latest as of 2026-04-20, from
`vercel-labs/just-bash`, Apache-2.0, deps: `seek-bzip`, `diff`,
`fast-xml-parser`, `minimatch`, `re2js`, `sql.js`, `quickjs-emscripten`, ...).

Relevant exports from `dist/index.d.ts`:

```ts
export { Bash, type BashOptions, type ExecOptions, type BashLogger } from "./Bash.js";
export { defineCommand, type CustomCommand, type LazyCommand } from "./custom-commands.js";
export { InMemoryFs } from "./fs/in-memory-fs/index.js";
export { MountableFs, type MountConfig, type MountableFsOptions } from "./fs/mountable-fs/index.js";
export { OverlayFs, type OverlayFsOptions } from "./fs/overlay-fs/index.js";
export { ReadWriteFs, type ReadWriteFsOptions } from "./fs/read-write-fs/index.js";
export type { NetworkConfig, AllowedUrl, SecureFetch } from "./network/index.js";
export { NetworkAccessDeniedError } from "./network/index.js";
export type { IFileSystem, BashExecResult, ExecResult, CommandContext } from "./types.js";
```

Critical shapes:

```ts
interface BashOptions {
  files?: InitialFiles;
  env?: Record<string, string>;
  cwd?: string;
  fs?: IFileSystem;
  executionLimits?: ExecutionLimits;
  fetch?: SecureFetch;
  network?: NetworkConfig;
  python?: boolean;
  javascript?: boolean | JavaScriptConfig;
  commands?: CommandName[]; // whitelist built-ins
  customCommands?: CustomCommand[]; // defineCommand(...)
  // ... more
}

class Bash {
  exec(commandLine: string, options?: ExecOptions): Promise<BashExecResult>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  getCwd(): string;
}

class ReadWriteFs implements IFileSystem {
  constructor(opts: { root: string; maxFileReadSize?: number; allowSymlinks?: boolean });
  readFile(path: string, options?: ReadFileOptions | BufferEncoding): Promise<string>;
  readFileBuffer(path: string): Promise<Uint8Array>;
  writeFile(path: string, content: FileContent, options?: ...): Promise<void>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<FsStat>;
  readdir(path: string): Promise<string[]>;
  mkdir(path: string, opts?: MkdirOptions): Promise<void>;
  rm(path: string, opts?: RmOptions): Promise<void>;
  // ... cp, mv, chmod, symlink, readlink, realpath, utimes, etc.
}
```

`ReadWriteFs` enforces sandbox root with symlink + TOCTOU protection — we
**must** always construct it with `allowSymlinks: false` for the MVP.

The docstring explicitly warns: _"New methods must use these gates — never
access the real FS directly."_ — so our wrapper should only go through
`ReadWriteFs` / `Bash` and never call `node:fs` against the sandbox root.

## 4. Concrete architecture we will implement

```
pi-mono session
  └─► pi-justbash-sandbox extension
        ├─► SandboxSession (one per pi session id)
        │     ├─ root: <sandboxBase>/<sessionId>
        │     ├─ fs: ReadWriteFs({ root, allowSymlinks: false })
        │     └─ bash: new Bash({ fs, cwd: root, env: {...} , network: undefined })
        │
        ├─► Tool replacements
        │     bash  → createBashTool(cwd, { operations: BashAdapter(sandbox) })
        │     read  → createReadTool(cwd, { operations: ReadAdapter(sandbox) })
        │     write → createWriteTool(cwd, { operations: WriteAdapter(sandbox) })
        │     edit  → createEditTool(cwd, { operations: EditAdapter(sandbox) })
        │     grep  → (disabled — registerTool returning error)
        │
        ├─► Lifecycle
        │     session_start           → ensure sandbox dir, register session
        │     session_before_switch   → flush cleanup for outgoing session
        │     session_before_fork     → copy root to fork target
        │     session_shutdown        → cleanup sandbox dir
        │     process SIGINT/TERM/HUP → cleanup all sessions
        │
        └─► Orphan reaper (startup)
              remove <base>/<id> where mtime < now - TTL
```

### 4.1 Operation adapters — source-level contract

`BashAdapter.exec(command, cwd, { onData, signal, timeout })` has to return a
`BashOperations` compatible promise. Implementation:

```
bash = new Bash({ fs, cwd: translatedCwd, env, network, executionLimits });
const out = await bash.exec(command, { onStdout, onStderr, signal, timeout });
onData?.(chunk);
return { exitCode: out.exitCode ?? 0 };
```

- `cwd` from pi is translated to a sandbox-relative path; any path escape
  reports an exit code 126 with a helpful stderr message instead of throwing.
- Streaming is flushed via `onData` using bash's chunk callbacks.
- Timeouts use `bash.exec(..., { timeout })` where supported, otherwise we
  race a timer and call `bash.abort()`-equivalent (ExecutionLimits).

### 4.2 Session root naming

`path.join(baseDir, `sess-${sessionId}-${shortHash(randomBytes(8))}`)`

- `sessionId` from `ctx.sessionManager.getSessionId()`.
- Random suffix to make concurrent test runs safe and prevent reuse.
- Created with `fs.mkdir(root, { recursive: true, mode: 0o700 })`.

### 4.3 Cleanup

- Primary path: `await fs.rm(root, { recursive: true, force: true, maxRetries: 3 })`.
- Fallback: on Windows EBUSY, retry once after 100ms.
- Orphan reaper runs once at factory init.

### 4.4 grep disablement

Two-stage disablement:

1. Register a `grep` tool that returns `isError: true` with the message
   `"grep is disabled by @sionic-ai/pi-justbash-sandbox; use bash grep inside the sandbox"`.
2. Additionally emit a `tool_call` handler that hard-blocks `grep`:
   `{ block: true, reason: "grep is disabled in sandbox" }`.

Defense in depth covers the case where another extension registers `grep`
first (then our `registerTool` would lose the race — but the blocker wins).

## 5. Tool list decisions (MVP vs later)

| Tool | MVP action | Notes |
|------|------------|-------|
| bash | replace    | via just-bash `Bash` instance, streaming + abort + timeout |
| read | replace    | delegate to `ReadWriteFs.readFile` + image MIME detection (buf 1KB) |
| write | replace   | delegate to `ReadWriteFs.writeFile` + `mkdir -p` parent |
| edit | replace    | uses read+write adapters; fine-grained diff handled by pi |
| grep | disable    | hard block via `tool_call` + error-returning replacement |
| ls, find | leave  | pi defaults still operate on host cwd until we decide otherwise |

Documented so a future PR can flip `ls`/`find` to sandbox-aware adapters.

## 6. References (all verified)

- https://github.com/badlogic/pi-mono (README, packages/coding-agent/docs/extensions.md)
- https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/tools/index.ts
- https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/examples/extensions/ssh.ts
- `npm view just-bash@2.14.2` → https://registry.npmjs.org/just-bash/-/just-bash-2.14.2.tgz
- just-bash repo: https://github.com/vercel-labs/just-bash
- `dist/index.d.ts`, `dist/Bash.d.ts`, `dist/fs/read-write-fs/read-write-fs.d.ts` from the v2.14.2 tarball

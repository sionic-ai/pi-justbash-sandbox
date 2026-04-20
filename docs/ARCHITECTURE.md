# Architecture — @sionic-ai/pi-justbash-sandbox

This document mirrors the architecture section of
[`docs/RESEARCH.md`](./RESEARCH.md) but with links into the code that
actually ships. See [`docs/RESEARCH.md`](./RESEARCH.md) for the raw
upstream-API findings that motivate every choice below, and
[`docs/AGENT_BRIEF.md`](./AGENT_BRIEF.md) for the phased implementation
roadmap.

## 1. Position in the stack

```
pi-mono session
  └─► pi-justbash-sandbox extension (this package)
        ├─► SandboxSessionRegistry   (src/session/session-registry.ts)
        │     └─► SandboxSession     (src/session/sandbox-session.ts)
        │
        ├─► Tool replacements        (src/tools/register-tools.ts)
        │     ├─► BashAdapter        (src/adapters/bash-adapter.ts)
        │     ├─► ReadAdapter        (src/adapters/read-adapter.ts)
        │     ├─► WriteAdapter       (src/adapters/write-adapter.ts)
        │     └─► EditAdapter        (src/adapters/edit-adapter.ts)
        │
        ├─► grep defense-in-depth    (src/tools/disable-grep.ts)
        │     ├─► replacement tool (execute() throws sandbox notice)
        │     └─► tool_call blocker ({ block: true, reason })
        │
        ├─► Lifecycle                 (src/lifecycle/install-lifecycle.ts)
        │     ├─ session_start        -> registry.acquire + register tools
        │     ├─ session_shutdown     -> registry.release
        │     ├─ session_before_switch/fork -> registry.release
        │     └─ SIGINT/TERM/HUP      -> registry.releaseAll
        │
        └─► Orphan reaper             (src/session/orphan-reaper.ts)
              sweep <base>/sess-<id>-<hex16> older than 12h on load
```

## 2. Session model

`SandboxSession` owns:

- a host-absolute root path shaped `<baseDir>/sess-<sessionId>-<hex16>`,
  created with `mkdir(..., { recursive: true, mode: 0o700 })`;
- nothing else (the fs + bash live in the adapters so they can be
  spun up once per call).

`SandboxSessionRegistry` maps `pi sessionId → SandboxSession`. It owns
the lifecycle: `acquire()` ensures, `release()` cleans + evicts,
`releaseAll()` drains. Every extension-facing component reads from the
registry instead of constructing `SandboxSession` directly.

Hardening implemented in `SandboxSession`:

- `sessionId` must be a single path component — empty strings, path
  separators, `.`, `..`, and NUL bytes are rejected at construction so a
  hostile pi session id cannot escape the base dir.
- `cleanup()` memoises its in-flight promise so concurrent callers share
  a single `fs.rm`, preventing double-rm races on SIGINT + session_shutdown
  firing at the same time.

## 3. Virtual path space

`just-bash`'s `ReadWriteFs` mounts a host directory at the virtual `/`
and enforces symlink + TOCTOU gates on every operation. Every adapter
translates the host-absolute path pi hands it into this virtual path via
`src/fs/sandbox-paths.ts::toVirtualPath()`:

```
toVirtualPath(root, `${root}/sub/dir`) === "/sub/dir"
toVirtualPath(root, "/outside")        // throws SANDBOX_ESCAPE
```

Because all four adapters go through the same `ReadWriteFs` instance,
the bytes returned by `ReadAdapter.readFile()` are guaranteed to be the
bytes `EditAdapter.writeFile()` will mutate. The sandbox fs always runs
with `allowSymlinks: false` (enforced by
`src/fs/create-sandbox-fs.ts::createSandboxFs`) so no caller can opt
out of the upstream security defaults.

## 4. BashAdapter semantics

Every `BashAdapter.exec(command, cwd, options)` call:

1. Translates the host `cwd` → virtual cwd, returning `exitCode 126`
   with a helpful stderr-style line through `onData` if the cwd is
   outside the sandbox.
2. Instantiates a fresh `just-bash` `Bash` scoped to `{ fs, cwd, env }`.
3. Wraps pi's `signal` and the numeric `timeout` in a single
   `AbortController` so `Bash.exec` can cooperatively stop at the next
   statement boundary.
4. Flushes `result.stdout` and `result.stderr` through `onData` in that
   order.
5. Maps the resolution:
   - pi signal tripped → `exitCode 130`
   - numeric timeout tripped → `exitCode 124` (plus a timeout notice
     through `onData`)
   - otherwise → pass `result.exitCode` through unchanged.

This matches the `timeout(1)` and POSIX signal exit code conventions
pi's UI already understands.

## 5. Lifecycle wiring

`installSandboxLifecycle(api, { registry })` subscribes to four events
(`session_start`, `session_shutdown`, `session_before_switch`,
`session_before_fork`). Every handler keys off
`ctx.sessionManager.getSessionId()`; `session_start` calls
`registry.acquire` (which ensures the root) and the three outgoing
events call `registry.release`. The extension entry point
(`src/index.ts`) additionally runs `registerSandboxTools` on each
`session_start` so the bash/read/write/edit registrations are
re-bound to the new session's root — pi-mono's first-registration-wins
rule then shadows the host-touching defaults for that session.

The returned handle's `reapAllSessions()` is wired into
`SIGINT`/`SIGTERM`/`SIGHUP` handlers so the process drains the registry
before re-raising the signal and exiting.

## 6. grep disablement

Two independent stages, both living in `src/tools/disable-grep.ts`:

- **Replacement tool**: `buildDisableGrepTool()` returns a
  `ToolDefinition` called `grep` whose `execute()` throws a sandbox
  notice. pi-mono's first-registration-wins rule makes this tool
  shadow the built-in grep as soon as the extension loads.
- **`tool_call` blocker**: `buildGrepToolCallBlocker()` returns an
  `ExtensionHandler` that returns `{ block: true, reason }` when
  `event.toolName === "grep"` and `undefined` otherwise. This catches
  any grep registration that won the race against our replacement — a
  safety net for the case where another extension also registers grep.

## 7. Orphan reaper

`reapOrphans({ baseDir, ttlMs })` (`src/session/orphan-reaper.ts`)
scans the base dir once at load time, matches entries against the
`sess-<id>-<hex16>` pattern, mtime-checks each one against a 12-hour
cutoff, and removes the expired ones with
`rm(..., { recursive: true, force: true, maxRetries: 3 })`. Errors on
individual entries are swallowed — a stale permission-denied dir
cannot block the extension from loading.

## 8. Out of scope (for v0)

- `ls` / `find` replacements — pi's defaults still operate on the host
  cwd. See the last table in `docs/RESEARCH.md` for the decision.
- `storm` / `storm-lint` custom commands — live in a separate Sionic
  repo.
- Network allow-list policy — the extension does not currently plumb
  `just-bash`'s `NetworkConfig`, so `Bash` runs with network disabled by
  default. A future `--sandbox-allow-network` flag will re-enable it.

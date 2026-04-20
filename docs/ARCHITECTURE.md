# Architecture — @sionic-ai/pi-justbash-sandbox

> Stub. The fully-annotated version lands with Phase F; this file gives
> future readers a stable entry point while the implementation is in
> flight. For the source-verified notes that drove the design, see
> [`docs/RESEARCH.md`](./RESEARCH.md).

## Position in the stack

```
pi-mono session
  └─► pi-justbash-sandbox extension (this package)
        ├─► SandboxSession         (one per pi session id)
        ├─► Tool replacements      (bash/read/write/edit via pi-mono factories)
        ├─► grep disablement       (hard-blocked via tool_call + error replacement)
        ├─► Lifecycle hooks        (session_start/shutdown/switch/fork + SIG*)
        └─► Orphan reaper          (startup cleanup of stale sandbox roots)
```

Each `SandboxSession` owns:

- a root directory (default `os.tmpdir()/pi-justbash/sess-<id>-<rand>`),
- a `ReadWriteFs` instance scoped to that root with `allowSymlinks: false`,
- a `just-bash` `Bash` instance bound to the same `IFileSystem`.

## Tool replacement strategy

pi-mono's `ExtensionRunner` iterates extensions in load order and the
**first registration per tool name wins**. We therefore register
`bash`, `read`, `write`, `edit` at factory time so they shadow the
built-in host-touching tools. `grep` is disabled two ways: an error-
returning replacement tool *and* a `tool_call` hook that hard-blocks the
call, defending against races with other extensions.

## Data flow (happy path)

1. pi starts a session → `session_start` hook fires.
2. The extension creates a `SandboxSession` and records it in the
   session registry keyed by pi session id.
3. The agent requests `bash {"command": "ls"}`.
4. `BashAdapter.exec` forwards to `Bash.exec` inside the sandbox, with
   cwd translated to a sandbox-relative path.
5. Streaming chunks are propagated to pi's `onData` callback; the
   final `{ exitCode }` returns up.
6. On `session_shutdown` (or SIGINT/SIGTERM/SIGHUP) the registry
   drains and each `SandboxSession.cleanup()` runs.

## Where to read more

- **API facts** (upstream symbols, shapes, version pins) → `docs/RESEARCH.md`.
- **Implementation roadmap** (phases, commit discipline) → `docs/AGENT_BRIEF.md`.
- **Public surface** (config flags, `exports` map) → `README.md`.

This document will be replaced by the final architecture write-up in
Phase F.4.

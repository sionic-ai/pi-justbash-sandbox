# @sionic-ai/pi-justbash-sandbox

Sandboxed `bash`, `read`, `write`, and `edit` tools for
[`@mariozechner/pi-coding-agent`](https://www.npmjs.com/package/@mariozechner/pi-coding-agent)
([`badlogic/pi-mono`](https://github.com/badlogic/pi-mono)) backed by
[`just-bash`](https://github.com/vercel-labs/just-bash).

## Why

Out of the box, `pi` runs shell and filesystem tools against the host. When
`pi` must be contained to a per-session workspace — no access to the rest of
the host, deterministic cleanup on exit — this extension:

- Replaces `bash` with a `just-bash` sandbox running inside a per-session
  root directory (`ReadWriteFs` with `allowSymlinks: false`).
- Replaces `read` / `write` / `edit` so they only touch the sandbox root.
- **Disables `grep`** at both the tool layer and the `tool_call` gate — use
  `bash grep` inside the sandbox instead.
- Creates and cleans up the sandbox root on every `session_start` /
  `session_shutdown`, on `session_before_switch` and `session_before_fork`,
  and on `SIGINT` / `SIGTERM` / `SIGHUP`.
- Reaps orphaned sandboxes older than 12 hours at load time.

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the data flow,
[`docs/RESEARCH.md`](./docs/RESEARCH.md) for the source-verified upstream
facts the design is anchored to, and [`docs/AGENT_BRIEF.md`](./docs/AGENT_BRIEF.md)
for the phase-by-phase implementation roadmap.

## Install

This package is **not published to npm**. Install it from GitHub, a
local clone, or a pinned git ref — pi-mono supports all three natively.
The package ships its built factory under `dist/`, so consumers only
need to point pi at the repository; no intermediate npm registry is
ever involved.

Prerequisites:

- `pi` (aka `@mariozechner/pi-coding-agent`) **>= 0.67.68** installed
  and on your `PATH`. See [badlogic/pi-mono](https://github.com/badlogic/pi-mono)
  for install instructions. pi supplies `@mariozechner/pi-coding-agent`,
  `@mariozechner/pi-agent-core`, and `@sinclair/typebox` at runtime, so
  consumers do not need to install those separately.

### Option A — Install via `pi install`

pi-mono's package manager speaks git and local paths directly. Each
form below pulls the repo, runs `npm install` in it (for `just-bash`),
builds nothing itself — this repo already commits `dist/` on releases
(see [Release flow](#release-flow)) — and loads the extension.

```bash
# Pinned git tag or branch (recommended)
pi install git:github.com/sionic-ai/pi-justbash-sandbox@main

# SSH
pi install git:git@github.com:sionic-ai/pi-justbash-sandbox

# Raw URL also works
pi install https://github.com/sionic-ai/pi-justbash-sandbox

# Local clone (absolute or relative path)
pi install /absolute/path/to/pi-justbash-sandbox
pi install ./pi-justbash-sandbox
```

To try it without persisting to settings:

```bash
pi -e git:github.com/sionic-ai/pi-justbash-sandbox
pi -e /absolute/path/to/pi-justbash-sandbox
```

### Option B — Declare it in `.pi/settings.json`

```jsonc
// .pi/settings.json
{
  "packages": [
    "git:github.com/sionic-ai/pi-justbash-sandbox@main"
  ]
}
```

pi auto-installs missing packages on startup, so this file alone is
enough for collaborators to pick up the sandbox on their next `pi` run.
Use `.pi/settings.json` for project-scoped installs and
`~/.pi/agent/settings.json` for global installs.

### Option C — Inline factory (embedding pi via the SDK)

When you embed pi inside your own Node or Bun program, import the
default factory directly from the cloned repo (no registry lookup):

```ts
import { DefaultResourceLoader } from "@mariozechner/pi-coding-agent";
import justbashSandbox from "./vendor/pi-justbash-sandbox/dist/index.js";

const resourceLoader = new DefaultResourceLoader({
  extensionFactories: [justbashSandbox],
});
```

Any path resolvable by Node / Bun ESM works here — a git submodule, a
vendored subtree, a workspace package, a `file:` spec in `package.json`,
etc. The only hard dependency on the filesystem side is that `dist/`
has been built (`pnpm build` / `bun run build`).

Once loaded, the extension takes over the host-touching tools as soon as pi
emits `session_start`; from there every `bash` / `read` / `write` / `edit`
tool call runs against the per-session sandbox root.

### CLI flags

| Flag | Type | Default | Meaning |
|------|------|---------|---------|
| `--sandbox-root <path>` | string | `$TMPDIR/pi-justbash` | Base directory under which per-session sandbox roots are created. |
| `--sandbox-max-file-size-mb <n>` | string | `10` | Override the maximum file read size for the sandbox fs. |

### Tool behaviour at a glance

| pi tool | In this extension |
|---------|-------------------|
| `bash`  | Runs inside a fresh `just-bash` `Bash` per call, bound to the session's `ReadWriteFs`. `stdout` + `stderr` are flushed through pi's `onData`; non-zero exits and `124`/`130` (timeout / abort) propagate unchanged. |
| `read`  | Reads through `ReadWriteFs.readFileBuffer`; image MIME detection covers PNG, JPEG, GIF, and WebP via their magic bytes. |
| `write` | Writes through `ReadWriteFs.writeFile` after auto-creating the virtual parent chain. |
| `edit`  | Shares the sandbox fs with `read` + `write`, so pi's diff always applies to the exact bytes it just read. |
| `grep`  | **Disabled.** `grep` is registered as a same-named stub that throws a sandbox notice, and a `tool_call` handler returns `{ block: true, reason }` so lingering grep calls from other extensions are rejected too. |
| `ls`, `find` | Left untouched — pi's defaults still operate on the host cwd. |

### Troubleshooting

- **"cwd ... is outside the sandbox" in bash output** — pi handed the bash
  tool a cwd that does not live under the sandbox root. The adapter
  returns exit code `126` in that case so the agent can recover. Point
  `--sandbox-root` at a directory that actually contains the cwd, or do
  the work via a command that `cd`s from the sandbox root.
- **Hitting file-size limits on read** — raise
  `--sandbox-max-file-size-mb`; the default matches `ReadWriteFs`
  (10 MiB).
- **Stale sandbox dirs piling up in `$TMPDIR/pi-justbash`** — the orphan
  reaper only removes dirs older than 12 hours on startup. Delete the
  base dir manually if you need to reclaim space sooner; it is safe
  while no pi process is running.

## Development

```sh
pnpm install       # or: bun install
pnpm test          # or: bun run test
pnpm lint          # or: bun run lint
pnpm typecheck     # or: bun run typecheck
pnpm build         # or: bun run build
```

Both `pnpm` and `bun` are first-class; CI runs the full matrix on each
push against Ubuntu and macOS.

## Release flow

This package is **not** distributed through npm (`package.json` sets
`"private": true` and a `prepublishOnly` guard blocks accidental
`npm publish`). Releases are plain git tags and the compiled `dist/`
output is checked into the repository on tag boundaries so that
`pi install git:...@<tag>` works without a separate build step on the
consumer's side.

To cut a release locally:

```sh
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm build
git add dist
git commit -m "build(dist): release vX.Y.Z"
git tag vX.Y.Z
git push --follow-tags
```

Consumers then pin the tag:

```bash
pi install git:github.com/sionic-ai/pi-justbash-sandbox@vX.Y.Z
```

## License

MIT — see [`LICENSE`](./LICENSE).

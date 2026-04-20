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

```sh
pnpm add -D @sionic-ai/pi-justbash-sandbox
# or
bun add -d @sionic-ai/pi-justbash-sandbox
```

The package declares `@mariozechner/pi-coding-agent@>=0.67.68` as a peer
dependency; your project must install a compatible version of pi.

## Use with pi

Add the extension to your `pi` project:

```jsonc
// .pi/settings.json
{
  "packages": ["npm:@sionic-ai/pi-justbash-sandbox@^0.0.0"]
}
```

…or register it inline when embedding pi via the SDK:

```ts
import { DefaultResourceLoader } from "@mariozechner/pi-coding-agent";
import justbashSandbox from "@sionic-ai/pi-justbash-sandbox";

const resourceLoader = new DefaultResourceLoader({
  extensionFactories: [justbashSandbox],
});
```

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

## License

MIT — see [`LICENSE`](./LICENSE).

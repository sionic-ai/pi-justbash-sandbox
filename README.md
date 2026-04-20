# @sionic-ai/pi-justbash-sandbox

Sandboxed `bash`, `read`, `write`, and `edit` tools for
[`@mariozechner/pi-coding-agent`](https://www.npmjs.com/package/@mariozechner/pi-coding-agent)
([`badlogic/pi-mono`](https://github.com/badlogic/pi-mono)) backed by
[`just-bash`](https://github.com/vercel-labs/just-bash).

> Status: **under active construction (pre-0.1).** This README is a spec; the
> initial implementation is being built in
> [`docs/AGENT_BRIEF.md`](./docs/AGENT_BRIEF.md) / [`docs/RESEARCH.md`](./docs/RESEARCH.md).

## Why

Out of the box, `pi` runs shell and filesystem tools against the host. For
deployments where the agent must be contained to a per-session workspace (no
access to the rest of the host, safe cleanup on exit), this extension:

- Replaces `bash` with a `just-bash` sandbox running inside a per-session
  root directory (`ReadWriteFs` with `allowSymlinks: false`).
- Replaces `read` / `write` / `edit` so they only touch the sandbox root.
- **Disables `grep`** at the tool layer — use `bash grep` inside the sandbox
  instead.
- Creates and cleans up the sandbox root on every `session_start` /
  `session_shutdown`, including on `SIGINT` / `SIGTERM` / `SIGHUP`.
- Reaps orphan sandboxes on startup.

## Install

```sh
pnpm add -D @sionic-ai/pi-justbash-sandbox
# or
bun add -d @sionic-ai/pi-justbash-sandbox
```

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

CLI flags exposed by the extension:

- `--sandbox-root <path>` — override the base directory for sandbox roots.
- `--sandbox-allow-network` — allow just-bash to make network calls (off by default).
- `--sandbox-max-file-size-mb <n>` — cap reads through the sandbox.

## Development

```sh
pnpm install       # or: bun install
pnpm test          # or: bun run test
pnpm lint          # or: bun run lint
pnpm typecheck     # or: bun run typecheck
pnpm build         # or: bun run build
```

Both `pnpm` and `bun` are first-class; CI runs the full matrix on each push.

## License

MIT — see [`LICENSE`](./LICENSE).

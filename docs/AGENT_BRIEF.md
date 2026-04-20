# Agent Brief — implement `@sionic-ai/pi-justbash-sandbox`

You are implementing the **initial release** of
`@sionic-ai/pi-justbash-sandbox` (repo: `sionic-ai/pi-justbash-sandbox`) from
scratch. Scaffolding + implementation + CI must all be produced in this repo
as **atomic, reviewable commits**. No scaffolding-from-a-tool magic: hand-write
and verify every file.

The end-to-end problem space is documented in `docs/RESEARCH.md`. **Read it
first.** It contains verified facts about the upstream APIs (`pi-mono`,
`just-bash`). Do not re-research; only follow up if the docs are incomplete.

## 1. Non-negotiables

- Language: **TypeScript**, `"strict": true`, `exactOptionalPropertyTypes`,
  `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `moduleResolution: bundler`.
- Type-checker: **`@typescript/native-preview` (`tsgo`)**, invoked via `tsgo -p tsconfig.build.json`
  for builds and `tsgo --noEmit` for CI type-check. Keep a `tsconfig.json`
  that extends the build config for editor tooling.
- Linter / formatter: **Biome** (`@biomejs/biome`). Config in `biome.json`.
  `lint`, `format`, and `check` scripts must exist.
- Test runner: **Vitest** (matches pi-mono upstream). Required suites:
  unit + integration.
- Dual runtime support for local dev: **pnpm + bun** must both work for
  `install`, `test`, `build`, `lint`. CI must exercise both.
- **Strict TDD**: no production code is added in the same commit as its first
  failing test. Sequence per feature:
  1. commit: "test(x): add failing test"
  2. commit: "feat(x): make it pass"
  3. commit: "refactor(x): ..." (optional)
- Atomic commits — one logical change per commit, conventional-commit style
  (`feat:`, `fix:`, `test:`, `chore:`, `docs:`, `refactor:`, `build:`, `ci:`).
- **Fully documented**: every exported symbol has a TSDoc block. `README.md`
  has install + pi config + usage sections. `docs/ARCHITECTURE.md` mirrors
  the architecture section of `RESEARCH.md` for future readers.
- Never downgrade TypeScript, Biome, tsgo, or Vitest without a documented
  reason in the commit body.
- **Do not invoke `pi` binaries or network services from tests.** All tests
  run hermetically in Node (or Bun) with the extension loaded via
  `DefaultResourceLoader({ extensionFactories: [...] })` from
  `@mariozechner/pi-coding-agent`.

## 2. Repository layout (target)

```
pi-justbash-sandbox/
├── .github/workflows/ci.yml
├── .gitignore
├── .editorconfig
├── biome.json
├── package.json
├── pnpm-workspace.yaml          # (even single package — keeps pnpm happy)
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
├── README.md
├── LICENSE
├── docs/
│   ├── RESEARCH.md              # already present
│   ├── AGENT_BRIEF.md           # already present
│   └── ARCHITECTURE.md
├── src/
│   ├── index.ts                 # default export = ExtensionAPI factory
│   ├── session/
│   │   ├── sandbox-session.ts   # SandboxSession class
│   │   ├── session-registry.ts  # per-pi-session map
│   │   └── orphan-reaper.ts
│   ├── fs/
│   │   └── create-sandbox-fs.ts # ReadWriteFs wrapper + defaults
│   ├── adapters/
│   │   ├── bash-adapter.ts      # BashOperations impl
│   │   ├── read-adapter.ts      # ReadOperations impl
│   │   ├── write-adapter.ts     # WriteOperations impl
│   │   └── edit-adapter.ts
│   ├── tools/
│   │   ├── register-tools.ts    # binds adapters via pi-mono factories
│   │   └── disable-grep.ts
│   └── config/
│       ├── options.ts           # zod or typebox schema for flags
│       └── defaults.ts
└── test/
    ├── unit/
    │   ├── sandbox-session.test.ts
    │   ├── adapters.bash.test.ts
    │   ├── adapters.read.test.ts
    │   ├── adapters.write.test.ts
    │   ├── adapters.edit.test.ts
    │   ├── disable-grep.test.ts
    │   └── orphan-reaper.test.ts
    └── integration/
        ├── extension-bootstrap.test.ts
        └── tool-call-through-pi.test.ts
```

## 3. Execution plan (commit-level roadmap)

Each bullet = one commit unless otherwise stated.

### Phase A — Scaffolding (infra only, no product code)

1. `chore(git): add .gitignore, .editorconfig, LICENSE (MIT)`
2. `build(package): add package.json with scripts (pnpm+bun)`
3. `build(ts): add tsconfig.json + tsconfig.build.json + tsgo in devDeps`
4. `build(biome): add biome.json + scripts`
5. `test(vitest): add vitest.config.ts + smoke test`
6. `ci: add GitHub Actions (pnpm + bun matrix, lint + typecheck + test + build)`
7. `docs: seed README.md + docs/ARCHITECTURE.md stub`

After Phase A, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and
the same commands under `bun` all succeed with an empty `src/index.ts`.

### Phase B — Sandbox core (TDD)

For each slice below, emit the failing test commit first, then the impl commit.

1. `test(session): SandboxSession creates isolated root under base dir`
   `feat(session): implement SandboxSession with ensure/cleanup`
2. `test(session): cleanup removes root + nested files`
   `feat(session): harden cleanup (retries, symlink-safe)`
3. `test(registry): per-pi-session registry maps sessionId → SandboxSession`
   `feat(registry): implement session-registry`
4. `test(reaper): removes stale dirs older than TTL; leaves fresh ones`
   `feat(reaper): implement orphan-reaper`

### Phase C — Adapters (TDD)

1. `test(adapter.bash): exec echo via just-bash yields stdout + exit 0`
   `feat(adapter.bash): implement BashAdapter on top of just-bash Bash`
2. `test(adapter.bash): stderr and non-zero exit code propagate`
   `feat(adapter.bash): wire stderr streaming + exitCode`
3. `test(adapter.bash): timeout aborts long-running command`
   `feat(adapter.bash): respect ExecOptions timeout + signal`
4. `test(adapter.read): reads UTF-8 file through ReadWriteFs`
   `feat(adapter.read): implement ReadAdapter`
5. `test(adapter.read): image MIME detection for small binary files`
   `feat(adapter.read): add detectImageMimeType support`
6. `test(adapter.write): writes create parent dirs and persist content`
   `feat(adapter.write): implement WriteAdapter`
7. `test(adapter.edit): read-then-write via edit tool works`
   `feat(adapter.edit): implement EditAdapter`

### Phase D — Tool registration + grep disablement

1. `test(tools): extension registers replacement bash/read/write/edit`
   `feat(tools): implement register-tools`
2. `test(tools): grep tool returns isError with sandbox notice`
   `feat(tools): implement disable-grep (tool + tool_call block)`

### Phase E — Lifecycle wiring

1. `test(lifecycle): session_start creates a new sandbox root`
   `feat(lifecycle): bind session_start handler`
2. `test(lifecycle): session_shutdown cleans up sandbox root`
   `feat(lifecycle): bind session_shutdown handler`
3. `test(lifecycle): session_before_switch / fork triggers appropriate cleanup or copy`
   `feat(lifecycle): implement switch + fork cleanup`
4. `test(lifecycle): SIGINT/SIGTERM cleans all registered sessions`
   `feat(lifecycle): install signal handlers`

### Phase F — Public entry point + docs

1. `test(integration): extension boots via DefaultResourceLoader + factory`
   `feat(ext): export default factory in src/index.ts`
2. `test(integration): pi-driven tool_call for bash/read/write runs inside sandbox`
   `feat(integration): harness test that drives a mock AgentSession`
3. `docs: finalize README with install + pi config snippets + troubleshooting`
4. `docs: finalize docs/ARCHITECTURE.md`

### Phase G — Polish

1. `chore: add CHANGELOG.md + 0.0.0 entry`
2. `ci: cache pnpm + bun; add concurrency group`
3. `chore(release): prepare publish-ready package.json (exports, files, types)`

If any step turns out to be impossible as described, **stop and document
the blocker** in `docs/OPEN_QUESTIONS.md` with the exact upstream symbol you
tried to reach for; do not silently skip it.

## 4. package.json expectations

Required scripts (use these exact names):

```jsonc
{
  "scripts": {
    "build": "tsgo -p tsconfig.build.json",
    "dev": "tsgo -p tsconfig.build.json --watch",
    "typecheck": "tsgo --noEmit",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "clean": "rm -rf dist coverage"
  }
}
```

Runtime deps:
- `just-bash` (pin `^2.14.2` at first; document in README if bumped).
- `@mariozechner/pi-coding-agent` — pin a recent version (0.67.68+) in
  peerDependencies. Declare both `dependencies` entry (for local dev) and
  peerDependencies entry.

Dev deps must include: `@biomejs/biome`, `@typescript/native-preview` (tsgo),
`typescript` (latest stable, used only for editor language service),
`vitest`, `@vitest/coverage-v8`, `@types/node`.

`engines`: `{ "node": ">=20.11", "pnpm": ">=9", "bun": ">=1.1" }`.

Publish settings: `type: "module"`, ESM only, `exports` map with
`import`/`types`, `files: ["dist"]`, `publishConfig.access: "public"`.

## 5. CI expectations (.github/workflows/ci.yml)

- Trigger: pushes to `main` + all PRs.
- Matrix: `{ runner: [ubuntu-latest, macos-latest], pkg: [pnpm, bun] }`
- Jobs: `lint`, `typecheck`, `test`, `build` — all four must pass.
- `concurrency: { group: ${{ github.ref }}, cancel-in-progress: true }`.
- Cache pnpm store and bun's `~/.bun/install/cache`.
- `actions/checkout@v4`, `actions/setup-node@v4` (node 20), `pnpm/action-setup`
  pinned, `oven-sh/setup-bun@v2` pinned.
- No network access beyond the package registry in tests (block via
  `NETWORK_ACCESS=deny` if you introduce a test proxy; otherwise rely on
  offline-friendly unit tests).

## 6. Commit discipline

- One file-pattern per commit when reasonable (e.g. don't lump `package.json`
  + src in one commit unless they are inseparable).
- No `WIP`, no `fix: typo` at the end of a feature commit — squash locally
  before pushing.
- Commit messages: conventional commits, ≤72-char subject, body explains
  _why_, references the phase (`Phase B.2`), and lists manual verification if
  any (e.g. `Verified: pnpm test && bun test`).

## 7. Definition of Done for this PR series

1. `main` has Phases A–F merged.
2. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
3. `bun run lint && bun run typecheck && bun run test && bun run build` green.
4. GitHub Actions green on `main`.
5. README install + usage snippet copy-paste works against a pi-mono
   sandbox project (verify by writing a smoke script under `examples/`).
6. No `TODO` markers in shipped source (search for `TODO:` in `src/`).

**Ping the owner in the PR description** once A–F are done; Phase G can
follow in a separate PR. Do not self-merge.

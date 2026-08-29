# AGENTS.md — working in this repo

## Setup

```sh
bun install                              # installs @tenacity-labs/knapsack from GitHub (pinned tag)
git config core.hooksPath .githooks      # activate the gates below (per clone)
```

## Git hooks

Hooks live in `.githooks/` and are version-controlled; the `git config
core.hooksPath .githooks` line above is the only activation step. Both
hooks mirror CI (`.github/workflows/ci.yml`) — a green local hook means a
green CI run.

- **pre-commit — static type check.** Runs `bun ./node_modules/typescript/bin/tsc --noEmit`
  (the repo's strict `tsc` gate; see the note in `.githooks/pre-commit` about why it is
  invoked through bun). Blocks the commit on any type error.
- **pre-push — unit + integration tests.** Runs `bun test`, which executes the suites in
  `test/`: unit tests plus the integration/port tests that drive `solve()` end-to-end
  against the `@tenacy-labs/knapsack` dependency (relief path, suffix pricing, ledger
  shape, sequence axis).

Emergency bypass (same as always): `git commit --no-verify` / `git push --no-verify`.
Don't — CI runs the same gates and will catch it.

## Commands

| Command | What it does |
|---|---|
| `bun ./node_modules/typescript/bin/tsc --noEmit` | strict type gate (what pre-commit runs) |
| `bun test` | unit + integration suite (what pre-push runs) |
| `bun run bench/relief-dp.ts` | relief-DP wall measurement |

## Repo facts agents should know

- Runtime is **bun** (CI pins 1.3.14); plain `node`/`bunx tsc` can misbehave on some
  hosts — prefer the invocation forms above.
- `@tenacity-labs/knapsack` is a git dependency (`github:Tenacy-Labs/knapsack#v0.3.0`),
  locked by `bun.lock`. Its own test suite runs in its repo, not here.
- The dependency's internals (SoA differential, native loader) are covered upstream;
  tests here consume only its public API.

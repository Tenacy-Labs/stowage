# AGENTS.md — working in this repo

## Setup

```sh
bun install                          # installs @tenacity-labs/knapsack (pinned git tag)
git config core.hooksPath .githooks  # activates the hooks below (per clone)
```

## Gates

Hooks live in `.githooks/` (version-controlled); the `core.hooksPath` line above is the only setup. The type and test gates mirror CI (`.github/workflows/ci.yml`) — green locally means green in CI.

| Hook | Runs | Blocks on |
|---|---|---|
| pre-commit | `bun ./node_modules/typescript/bin/tsc --noEmit` | any type error |
| pre-push | `bun test` (unit + integration suites in `test/`) | any test failure |
| commit-msg | conventional-prefix check (`.githooks/commit-msg`) | subject lacking a `feat:`/`fix:`/`chore:`/… type |

`tsc` is invoked through bun — plain `bunx tsc` misbehaves on some hosts. Bypass is `--no-verify`; don't — CI runs the same gates.

CI additionally gates coverage (`scripts/coverage-gate.ts`): total line coverage must not decrease vs the base, and new `src/` lines must be ≥ 80% covered (files never loaded by tests count as fully uncovered).

`main` requires the CI jobs (`test`, `bench`, `e2e`) as status checks; PRs marked auto-merge land once they pass (`gh pr merge --auto --merge`).

Also: `bun run bench/relief-dp.ts` — relief-DP wall measurement.

## Repo facts

- Runtime is **bun** (CI pins 1.3.14); prefer the invocation forms above.
- `@tenacity-labs/knapsack` is a git dependency (`github:Tenacity-Labs/knapsack#v0.3.0`) locked by `bun.lock`. Its internals and test suite live upstream; tests here consume only its public API.

## Releases

Release Please drives versions: conventional commits (`feat:`, `fix:`) on main keep a release PR open, and **merging that PR is the release gesture** — it bumps the version, updates `CHANGELOG.md`, tags `v*`, and the Release workflow publishes to GitHub Packages after re-running the gates. PR titles use the same prefixes.

- Don't hand-edit `version` or `.release-please-manifest.json`; the release PR owns them.
- `chore:`/`ci:`/`docs:` commits don't trigger releases.
- Manual `git tag v*` + push is a publish (fallback path) — avoid.
- Consumers install from GitHub Packages; the `@tenacy-labs` scope must map to `npm.pkg.github.com` in their `.npmrc` (README "Install").

# CODE REVIEW — PR #6: native prebuilt matrix (loader extension map + ship-native workflow)

- **Repo:** Connectotron/stowage · branch `ci/native-matrix` · commit `9b7a605` (single commit)
- **Base:** `main` @ `9416fa1` (merge-base == main tip → fast-forward-able, no drift)
- **Reviewer:** fresh-context merge gate, 2026-08-24
- **Scope ruling:** owner 2026-08-24 — "build a wide variety of native builds on ci/cd"

## Verdict: **APPROVE**

No blockers, no majors. Four minor notes below, none gating. Gates re-run green
(674/674 + tsc clean + native differential 500/500 live on this host). Diff is
exactly the four declared files; tree clean.

---

## A. Loader diff correctness (`vendor/knapsack/src/native.ts`) — PASS

Read in full post-change; diff vs base inspected hunk-by-hunk.

- **`tripleFor(os, arch)` is pure:** string in → freshly-allocated `{t, ext}` out;
  no `process`/env/module-state access. `triple()` (the old name) is now a one-line
  wrapper passing `process.platform/arch` — host reads stay at the call site, so
  the pure function is trivially unit-testable.
- **Extension map correct:** darwin→`.dylib`, linux→`.so`, win32→`.dll`; five
  (os,arch) pairs; everything else `null`. `win32/x64 → x86_64-pc-windows-msvc.dll`
  is the new mapping. Old code appended a hardcoded `.dylib` to every triple — the
  linux/windows exts were latently wrong but unobservable (no such artifacts
  committed), so this is a strict fix with no regression surface.
- **THIS-host filename contract byte-identical:** old path
  `prebuilt/${t}.dylib` with `t="aarch64-apple-darwin"` vs new
  `prebuilt/${t.t}${t.ext}` = `"aarch64-apple-darwin" + ".dylib"` — identical
  string. The committed artifact `native/prebuilt/aarch64-apple-darwin.dylib`
  still resolves; sha256 recomputed = `619d097c…f26f1b`, size 349840 — both match
  the PROVENANCE table row exactly.
- **Override path untouched:** `KNAPSACK_NATIVE_DYLIB` branch precedes triple
  resolution exactly as before (diff shows only the one template-literal line
  changed inside `tryLoad`).
- **Cache semantics unchanged:** `cached` sentinel (`undefined`=untried,
  `null`=failed) logic identical; `tripleFor` runs at most once per process per
  cache epoch, so the new object allocation is not on any hot path.
- **Export safety:** `grep -rn tripleFor` → referenced only by `native.ts` itself
  and `test/native.test.ts`. No production importer, no re-export through
  `src/index.ts`; package is consumed as source (`exports: "./src/index.ts"`), no
  bundling/tree-shaking assumption broken.

## B. Workflow validity (`.github/workflows/ship-native.yml`) — PASS

YAML parses (python yaml.safe_load); single job `build`; trigger is
**workflow_dispatch only** (confirmed via parsed keys) — matrix changes cannot
re-run host CI, matching the declared intent. `permissions: contents: read` —
least privilege. No untrusted input is interpolated into `run:` (the only
workflow_dispatch input, `note`, is never used in a script — no injection surface).

Matrix (5 include entries, `fail-fast: false`):
| os | triple | ext | cross | plausible? |
|---|---|---|---|---|
| macos-15 (arm64) | aarch64-apple-darwin | .dylib | no | native host ✓ |
| macos-15 (arm64) | x86_64-apple-darwin | .dylib | yes | rustup target add suffices; Apple clang links `-target x86_64-apple-darwin` with no extra linker env — standard practice ✓ |
| ubuntu-latest | x86_64-unknown-linux-gnu | .so | no | native ✓ |
| ubuntu-latest | aarch64-unknown-linux-gnu | .so | yes | needs linker, provided (below) ✓ |
| windows-latest | x86_64-pc-windows-msvc | .dll | no | native MSVC ✓ |

- **Linux arm64 cross-compile:** `gcc-aarch64-linux-gnu` + `CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc`. Env-var name follows cargo's documented convention `CARGO_TARGET_<triple uppercased, - → _>_LINKER` — spelled correctly. Conditional `if: matrix.triple == 'aarch64-unknown-linux-gnu'` gates it to the one job that needs it.
- **Toolchain pin:** `dtolnay/rust-toolchain@1.95.0` — verified via GitHub API that `1.95.0` is a real ref on that repo (dtolnay's per-version branch convention; HTTP 200 on the branch endpoint, action.yml on that ref exposes the `targets` input). `targets: ${{ matrix.cross && matrix.triple || '' }}` evaluates to the triple exactly when `cross: true`, else empty — valid GH-expression short-circuit; empty targets is the action's no-op default. Local `cargo 1.95.0` matches the pin.
- **Windows dll naming:** `Cargo.toml` has `[lib] name = "knapsack_native", crate-type = ["cdylib"]`. On MSVC a cdylib produces `knapsack_native.dll` (no `lib` prefix). The staging step defaults `src=target/{triple}/release/libknapsack_native{ext}` and overrides to `knapsack_native.dll` when `ext == ".dll"` — handles all three naming shapes (`libknapsack_native.dylib/.so`, `knapsack_native.dll`) correctly.
- **`[ … ] && src=…` under `bash -e`:** probed with `bash --noprofile --norc -eo pipefail` exactly as GitHub invokes it — the failing `[ ]` on non-dll legs is exempt from `set -e` (non-final command of an `&&` list) and the script continues. Both legs verified rc=0. (`shell: bash` on the staging step makes it git-bash on windows-latest, where `sha256sum` ships in coreutils — consistent.)
- **`sha256sum * > SHA256SUMS`:** probed — pathname expansion happens before the redirect creates `SHA256SUMS`, so the glob sees only the artifact (1 checksum line; no self-hash). `cd staging` first, so the manifest covers exactly the staged binary.
- **Artifacts:** `actions/upload-artifact@v4`, per-triple unique names `native-{triple}`, paths under `vendor/knapsack/native/staging/*`. Matrix has no duplicate triples → no artifact-name collisions.
- **Build step:** `working-directory: vendor/knapsack/native` + `cargo build --release --target {triple}`; on windows the default pwsh shell is fine (no bash-isms in that line). Top-level `RUSTFLAGS: ""` matches the max-compat no-target-features policy and the dtolnay action's documented recommendation.

## C. Test honesty (`vendor/knapsack/test/native.test.ts`) — PASS

Three new tests in a dedicated `describe`:

1. **All five triples pinned with `toEqual` on the full object** — any change to
   any triple string or ext fails. Discriminates against a wrong extension map.
2. **Committed filename pinned:** `tripleFor("darwin","arm64")` must concat to
   exactly `aarch64-apple-darwin.dylib` — guards the byte-identical contract for
   the one artifact actually in-tree. Combined with the pre-existing
   500-problem differential (which dlopens the real file and asserts
   `ran > 0`), the contract is exercised end-to-end on this host: renaming the
   artifact or breaking the darwin/arm64 mapping fails two independent tests.
3. **Unsupported hosts → null** (`freebsd/x64`, `linux/ia32`) — discriminates
   against an accidental catch-all/fallback triple.

Test delta is exactly +3: base worktree (`git worktree` @ 9416fa1, /tmp) runs
**671/674-scale → 671 pass**, PR branch runs **674 pass**, both 0 fail. No
double-counting from the `node_modules/@connectotron/knapsack` copy (bun test
discovers the vendor tree; the nm copy is stale pre-PR content, sha differs, and
the +3 delta proves the vendor file is the one executing).

## D. Gates re-run (this host, darwin arm64) — PASS

| Gate | Result |
|---|---|
| `bun test` (root) | **674 pass / 0 fail**, 9275 expect() calls, 11 files — rc 0 |
| `bun x --bun tsc --noEmit` (root) | clean, rc 0 |
| `bun x --bun tsc --noEmit` (vendor/knapsack) | clean, rc 0 — changed file is inside this include scope (`src`, `test`) |
| Native liveness | differential log: `ran 500 of 500 problems; mismatches 0` via `[native-kernel]` — the committed dylib loads and agrees with SoA post-change |

## E. No strays — PASS

`git diff --name-status 9416fa1..HEAD` = exactly:
```
A  .github/workflows/ship-native.yml
M  vendor/knapsack/native/prebuilt/PROVENANCE.md
M  vendor/knapsack/src/native.ts
M  vendor/knapsack/test/native.test.ts
```
Single commit `9b7a605`; `git status --porcelain` clean before review doc; no
lockfile/package.json churn; host `ci.yml` untouched.

## F. Docs (`PROVENANCE.md`) — PASS (one nit)

Verification bullet now correctly describes `prebuilt/{triple}{ext}` with the
platform ext list and points at `tripleFor` — matches the code. Committed dylib's
recomputed sha256/size match the table. Nit below re: the intro line.

---

## Findings by severity

### Blocker / Critical / Major
None.

### Minor (non-gating)
1. **[workflow] Unused `note` input** — declared with description "Optional note
   recorded in the artifact bundle" but never referenced by any step, so nothing
   records it. Either `echo "$NOTE" > staging/BUILD_NOTE` (via `env:` mapping) or
   drop the input. Misleading-as-is, harmless in effect.
2. **[docs] PROVENANCE.md line 3 still says `prebuilt/{triple}.dylib`** — the
   intro sentence kept the old all-dylib shape while the Verification section
   was updated to `{triple}{ext}`. Trivially true for the single current prebuilt
   (darwin), but one word of internal inconsistency; fix opportunistically when
   the first non-darwin artifact lands.
3. **[workflow] `[ cond ] && assignment` idiom** — verified safe under
   `bash -eo pipefail` (probe: both legs rc 0), but an `if/then` would be
   self-evidently so; consider it if the file is touched again.
4. **[supply chain] `dtolnay/rust-toolchain@1.95.0` is a moving branch ref**, not
   an immutable SHA. This matches the repo's existing convention
   (`oven-sh/setup-bun@v2`, `actions/checkout@v4`), so not a regression — noting
   for a possible future repo-wide SHA-pinning pass.

### Notes (environment, not code)
- Local `node_modules/@connectotron/knapsack` is a stale pre-PR copy (`file:`
  dependency; `bun install` not re-run after the vendor edit). CI's fresh
  `bun install --frozen-lockfile` copies the new tree, and the +3 test delta
  proves the vendor tests execute regardless — but reviewers reproducing local
  gates should `bun install` after checkout. Behavior on this host is identical
  either way (old and new loaders produce the same darwin/arm64 path; no
  non-darwin artifacts exist yet, so no host anywhere changes behavior).

## Conclusion

The loader refactor is minimal, pure where claimed, and provably non-regressive
for the committed artifact; the workflow is well-formed with correct
cross-compile conventions, correct MSVC dll naming, and no injection surface;
the new tests genuinely discriminate; all gates pass on re-run; the diff is
exactly as declared. **APPROVE.**

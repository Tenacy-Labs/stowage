# CODE REVIEW — PR #7: wide native prebuilts artifact drop

- **PR**: Connectotron/stowage #7 `ci: ship wide native prebuilts (5 triples, CI-built)`
- **Branch**: `ci/native-artifacts` (2 commits: `b6b4933`, `aac616a`) → base `main` @ `2a84d68`
- **Reviewer scope**: fresh-context merge gate. Artifact integrity vs CI run, PROVENANCE accuracy, no strays, loader behavior, gates re-run, adversarial probes.
- **Verdict: APPROVE** ✅

---

## What the PR is

Commits 4 CI-built native prebuilts under `vendor/knapsack/native/prebuilt/` (from `ship-native` workflow_dispatch run **32782336658**, all 5 matrix jobs green) and updates `PROVENANCE.md` to a 5-row table. The local `aarch64-apple-darwin.dylib` pin is retained. No source, test, or workflow changes.

## Claim-by-claim verification

### A. Artifact integrity — VERIFIED ✅

`file(1)` types, sizes, and sha256 of every staged file vs the PROVENANCE table:

| file | size | file(1) | sha vs PROVENANCE |
|---|---|---|---|
| aarch64-apple-darwin.dylib | 349840 | Mach-O 64-bit shared library **arm64** | match |
| x86_64-apple-darwin.dylib | 337816 | Mach-O 64-bit shared library **x86_64** | match |
| aarch64-unknown-linux-gnu.so | 356648 | ELF 64-bit LSB shared object, **ARM aarch64** | match |
| x86_64-unknown-linux-gnu.so | 343064 | ELF 64-bit LSB shared object, **x86-64** | match |
| x86_64-pc-windows-msvc.dll | 102912 | **PE32+ executable (DLL) x86-64**, MS Windows | match |

All 5 export the `knapsack_dp` symbol (`nm -gU` on Mach-O/ELF; `strings` on the PE).

**Re-download proof**: re-downloaded all 5 artifacts of run 32782336658 to `/tmp` and compared:

- The **4 new committed binaries are byte-identical (sha256) to the CI artifacts**, and each CI artifact matches its own CI-generated `SHA256SUMS`. The commit carries exactly what CI built.
- The run's `headSha` is `2a84d681…` = the PR base `main`, so the binaries were built from precisely the source tree this PR lands on (which itself changes no Rust source).
- `aarch64-apple-darwin` differs between CI and the committed local pin **exactly as documented**: same size (349840), different bytes. Verified distinct Mach-O UUIDs (`dwarfdump --uuid`: `12D65709-…` CI vs `EFA0EA22-…` local). See Minor-1 for a documentation nuance.

### B. No strays — VERIFIED ✅

`git diff --name-status 2a84d68..HEAD` touches exactly 5 paths: the 4 new binaries + `PROVENANCE.md` (+5/−1 lines, table rows only). Per-commit split confirmed: `b6b4933` = PROVENANCE + 3 binaries; `aac616a` = windows dll alone. The second commit's story checks out — CI's windows `SHA256SUMS` line is the only star-marked name (`*x86_64-pc-windows-msvc.dll`), which is what a naive checksum-name parser would miss. Working tree clean; no stray files in `prebuilt/` on disk; no `.gitattributes`/LFS/ignore changes.

### C. Loader behavior — VERIFIED ✅

- `vendor/knapsack/src/native.ts` `tripleFor()` derives one exact filename `prebuilt/{triple}{ext}` from `(process.platform, process.arch)`; there is **no directory scan**, so wrong-triple files present on disk are unreachable and inert. `dlopen` is fully wrapped in try/catch → `null` → SoA fallback.
- On this aarch64 host the default (no override) path loads the committed local pin: local suite printed `[native-kernel] differential ran 500 problems; mismatches 0`.
- **CI evidence (first native run on linux)**: PR check run 32782658958 (`CI` on `ubuntu-latest` x86_64, headSha = PR HEAD `aac616a`) logged `[native-kernel] differential ran 500 problems; mismatches 0` — the *ran* branch, not the "no dylib on this host → differential skipped" branch that CI printed before this PR. Since CI's host triple is `x86_64-unknown-linux-gnu`, the loader dlopened the new `.so` and the 500-problem differential passed through it (`vendor/knapsack/test/native.test.ts` likewise: `differential ran 500 of 500 problems; mismatches 0`).

### D. PROVENANCE accuracy — VERIFIED ✅

Every row's size + sha256 matches the staged file (table above). Labels are honest and consistent with `ship-native.yml`: `cross: ubuntu-latest + gcc-aarch64-linux-gnu` (matches the workflow's cross-linker step), `cross: macos-15 runner` (x86_64 darwin built via target on the arm64 mac runner), `native: ubuntu-latest` / `native: windows-latest MSVC`. The aarch64-apple-darwin row explicitly documents the retained-pin decision with the size-identical/not-bit-identical rationale. Rust pin (1.95.0) matches the workflow's `dtolnay/rust-toolchain@1.95.0`.

### E. Gates — VERIFIED ✅ (re-run locally)

- `bun test`: **674 pass / 0 fail** (9275 expect() calls, 11 files) — with all 5 prebuilts present on disk.
- `bun x --bun tsc --noEmit`: rc 0, clean.
- CI PR check (same head commit): 674/674 + tsc, 21s, pass.

### F. Adversarial probes — VERIFIED ✅ (script in `/tmp/pr7-probe/`, repo untouched)

Using `KNAPSACK_NATIVE_DYLIB` overrides:

1. **Wrong-triple forced** (`aarch64-unknown-linux-gnu.so` on darwin-arm64): `nativeAvailable() === false` — dlopen fails honestly, caught, `solveDpNative` returns `null` → SoA fallback; SoA still solves.
2. **CI-built `aarch64-apple-darwin.dylib` from run 32782336658** (the non-identical build): loads (`nativeAvailable() === true`) and the **500-problem differential agrees with SoA on value/weight/choices/cellsVisited — 0 mismatches**. So the retained local pin and the CI build are behaviorally equivalent; the pin decision costs nothing in correctness.
3. **Committed local pin** baseline: loads, 500/500, 0 mismatches.

---

## Severity findings

### Blocker
None.

### Major
None.

### Minor
1. **PROVENANCE aarch64 row — "Mach-O UUIDs" is an incomplete causal claim.** The CI-vs-local diff spans 19,291 regions / ~254 KB of differing bytes: embedded build paths (`runner/work/stowage` vs `kipp/openclaw-robby`), differing code layout from a different build host, *and* the UUIDs. The operational claim ("size-identical, not bit-identical") is accurate and the pin decision is well-reasoned, but attributing the delta solely to UUIDs undersells it. Suggested follow-up wording: "not reproducible across hosts (embedded build paths, codegen layout, Mach-O UUIDs)". Non-blocking: probe 2 proves behavioral equivalence regardless.
2. **PROVENANCE preamble now slightly stale.** It still presents the local `cargo build --release` recipe as *the* rebuild recipe, while 4 of 5 rows are now CI-built; the canonical reproduction path for those is the `ship-native` workflow (workflow_dispatch). A one-line pointer would make the doc fully self-describing. Cosmetic.

### Nits
- Pre-existing (not this PR): `aarch64-apple-darwin.dylib` is mode `100755` while the 4 new binaries are `100644`. Harmless for `dlopen`; unify someday for tidiness.
- `x86_64-apple-darwin.dylib` and `aarch64-unknown-linux-gnu.so` are "not stripped" per `file(1)` (debug/BTI notes in .so; symbols present). Consistent with the max-compat/no-extra-flags policy; no action needed.

---

## Verdict

**APPROVE.**

- The 4 new binaries are byte-identical to green CI run 32782336658 (built from the exact PR base sha) — independently re-downloaded and sha-verified, not taken on faith.
- PROVENANCE is accurate in every checkable field; the one soft spot (UUID-only wording) is a doc nuance, empirically resolved by the 0-mismatch differential through the CI aarch64 build.
- No strays; loader contract holds by construction (exact-filename lookup, no scan) and by evidence (linux CI ran the kernel through the new `.so`, 500/500, 0 mismatches; wrong-triple override degrades honestly to SoA).
- Gates re-run locally: 674/674 + tsc clean.

Tree left clean vs HEAD; no production files modified; probes confined to `/tmp`.

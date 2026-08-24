# Code Review — PR #4: native SIMD DP kernel (`dpKernel: "native"`) with TS fallback

- **PR:** perf/native-simd @ 667dd52 → main (+589/−4, 9 files)
- **Reviewer method:** fresh-context read of `native/src/lib.rs`, `src/native.ts`, `src/solve.ts`, `src/dp-soa.ts`, `src/dp.ts`, `src/validate.ts`, both test files; live execution of both native test files and full suites on this aarch64 host (dylib present); adversarial probes (profit-corruption sensitivity, infeasible rc −2, single-group, capacity 0, huge-weight inputs); `bun x --bun tsc --noEmit`; git hygiene inspection.
- **Verified locally:** stowage `bun test` 662/662 pass; vendor `bun test` 634/634 pass; 500-problem differential ran 500/500 with **0 mismatches** on BOTH test files (value, weight, choiceIndex, cellsVisited); root `tsc --noEmit` exit 0.

## Verdict: **REQUEST CHANGES**

One critical memory-safety defect reachable from validated public input. Everything else in the PR is solid — the fallback contract, dispatch, and differential harness are genuinely well built. Fix the loader/kernel input-range hole and document dylib provenance; the rest is minor.

---

## Critical

### C1. Validation-passing weights ≥ 2³¹ abort the process (and can corrupt memory) on dylib hosts

`validateProblem` bounds capacity (≤ 2²¹−1) and ΣmaxProfit (< 2³¹) but does **not** bound individual option weights — only the envelope ΣmaxProfit·maxWeight < 2⁵³. A weight of e.g. `2³¹+100` with small profits passes validation. `solveDpNative` flattens weights into an `Int32Array`, where it truncates to a **negative** i32. In `lib.rs`:

- **g0 seeding (line 115):** `if w <= cap as i32 && flat_p[i] > prev[w as usize]` — a negative `w` passes `w <= cap`, then `prev[w as usize]` sign-extends to ~1.8e19 → Vec bounds-check panic. With `panic = "abort"` (Cargo.toml) inside a cdylib, this is a **process abort**, not a catchable error.
- **gather path (lines 129–141):** a negative `wi` is not filtered by `if wi > hi`, and `gather_max` uses raw pointers with no bounds checks (`*cur.add(w)`, `*prev.add(w - sh)`, `*bp.add(bp_base + w)`). For single-huge-weight groups the window arithmetic happens to collapse `w_start ≥ w_end` (empirically survived — see below), but with multiple huge-weight options in a group the wrapped `lo/hi` arithmetic can produce `w_start < w_end` at wrapped-usize magnitudes → genuine out-of-bounds reads **and writes**. I did not deliberately trigger the wild-write variant (refused to corrupt the host process); the panic alone establishes the class.

**Reproduced** (this host, via the public API — not by calling the kernel directly):

```ts
import { solve } from "vendor/knapsack/src/solve.ts";
const big = 2147483748; // 2^31 + 100; envelope: 2·(2^31+100) < 2^53 → validation PASSES
solve({
  groups: [
    { id: "g0", options: [{ id: "zero", weight: 0, profit: 0 }, { id: "huge", weight: big, profit: 2 }] },
    { id: "g1", options: [{ id: "a", weight: 30, profit: 1 }, { id: "b", weight: 60, profit: 1 }] },
  ],
  capacity: 100,
}, { dpKernel: "native" });
// → dpKernel "reference": status "optimal", value 1 (correct)
// → dpKernel "native":  thread panicked at src/lib.rs:115:47:
//    index out of bounds: the len is 101 but the index is 18446744071562068068
//    process exits rc −6 (SIGABRT)
```

Placing the huge weight in g1 instead of g0 *survives* and agrees with the reference — the behavior is input-placement-dependent (crash vs. silently-lucky), which is the signature of unchecked truncation. All TS kernels handle the same input gracefully (typed-array OOB reads yield `undefined` → `NaN` compares false → option effectively ignored).

**Fix (small, one place):** in `native.ts` `solveDpNative`, when flattening, reject any weight or profit outside a safe i32 range (weight not in `0..2³¹−1`, profit not in `0..2³¹−1`) → return `null` → existing chain falls back to `solveDpSoa`, which already handles these inputs. Belt-and-braces: in `lib.rs`, validate `flat_w`/`flat_p` values and `capacity ≥ 0` up front and return an error rc instead of trusting the FFI edge (also protects direct callers; note `capacity < 0` → `width` wraps → giant `vec!` allocation abort). Add a regression test: the repro above must equal the reference result, not die.

## Major

### M1. Committed prebuilt dylib has no documented provenance
`vendor/knapsack/native/prebuilt/aarch64-apple-darwin.dylib` (348 KB Mach-O arm64, exports `_knapsack_dp`) is committed with zero accompanying documentation: no build recipe, no rustc/cargo version or platform pin (no `rust-toolchain.toml`), no checksum, and no mention of `native/` or `prebuilt/` anywhere in `vendor/knapsack/README.md` (grep: zero hits). The loader supports four triples but only one dylib ships, and how to produce the others (or rebuild the shipped one from `lib.rs`) is undocumented. Spike READMEs under `docs/spikes/` contain a generic `cargo build --release`, not tied to this artifact. For a binary committed into the repo, provenance is a hygiene requirement (this review's scope E) and a supply-chain baseline. Add a short `native/README.md`: exact build command, toolchain version, release flags used, sha256 of the committed dylib, and the policy for adding new triples.

## Minor

1. **Vendor typecheck broken by the new test.** `cd vendor/knapsack && bun x --bun tsc --noEmit` fails: `test/native.test.ts(39,17): TS2345 — Property 'originalCount' is missing in type '...ReducedGroup'` (the generator omits `originalCount`; the stowage-side twin includes it). Root `tsc` and CI are unaffected (root tsconfig includes only root `src`/`test`), but the vendor package's own `bun run typecheck` script now fails. One-line fix: add `originalCount: options.length` in the vendor generator.
2. **Kernel ignores caller's `maxDpBytes`.** `solveDpNative(reduced, capacity, maxDpBytes)` accepts a budget but the Rust gate hardcodes `DEFAULT_DP_BUDGET` (50 MiB). With `solve(..., { dpKernel: "native", maxDpBytes: 100MiB })` a 60 MiB table passes the TS gate, gets rc −1 from the kernel, and silently falls back to SoA — correct but surprising. Pass the budget through (extra FFI arg) or document the 50 MiB native hard cap in `SolveOptions`.
3. **CI never exercises the native path.** CI is linux x86_64 with no dylib → the differential skips (honest: logs + `ran > 0` guard) and only the fallback contract is tested. Acceptable trade-off, but it means kernel regressions are caught only on dev Macs. Worth a line in the PR description acknowledging this coverage gap (or a macos CI job later).
4. **`countCells` is a simulation, not a measurement.** `cellsVisited` for native results is recomputed by re-deriving the SoA window arithmetic rather than counting actual kernel work. It's documented as such in `native.ts` and keeps stats comparable — fine — but a one-word comment on the returned field ("mirror of soa's counter, not kernel work") would prevent future misreading.
5. **`DEFAULT_DP_BUDGET` now lives in three places** (dp.ts, lib.rs, native.ts import). Each carries a "keep in sync" comment; acceptable at this size, just noting the triplication.
6. **`panic = "abort"` in the cdylib profile** converts any future in-kernel panic into a host-process abort with no recovery. Once C1's in-kernel validation lands this becomes defensive posture rather than a live risk; consider `panic = "unwind"` + a `catch_unwind` at the FFI edge returning an error rc so a kernel bug can never take down the host.

---

## What was verified and found correct

- **Kernel ↔ oracle equivalence (validated-input domain):** recurrence, windowing (`lo/hi` formulas, `window_lo += g_min`, `window_hi = hi`), g0 seeding (min/max from data, first-writer-wins in option order), tie-break identity (option-outer gather with strict `>` ≡ oracle's per-cell argmax with strict `>` over options in index order — first max wins in both), `i32::MIN` sentinel semantics (phantom values provably stay < 0 given ΣmaxProfit < 2³¹, so they can never win the final scan; `SENT + pi` cannot overflow for validated profits), traceback (`bp` u8 indices, `≤ 255` options enforced by validation and preserved by reduction), infeasible rc −2 → `{value:-1, weight:-1, choiceIndex:[]}` ≡ oracle. 500/500 differential clean on both test files, including tie-heavy seeds.
- **Differential is non-vacuous:** adversarial probe — bumping one chosen option's profit on the native input only — produced an immediate mismatch catch (56590 vs 56611). The harness can fail; it isn't structurally incapable of failing. `ran > 0` guard present in both differentials.
- **Loader (`native.ts`):** dlopen fully contained in try/catch → `null`; env override (`KNAPSACK_NATIVE_DYLIB`) honored with empty-string treated as unset; cache (`cached` set to `null` *before* the attempt, so a throw can't leave `undefined` looping) and `_resetNativeCache` correct; corrupt-path test restores env and cache in `finally`.
- **Dispatch (`solve.ts`):** bounded-mode-over-budget branch keeps precedence; native under budget → null → SoA under budget → reference/D&C; default options (`dpKernel` absent/`"reference"`) behaviorally unchanged (diff is purely additive around the dispatch); `n === 0` guard protects direct callers.
- **Test honesty (D):** fallback tests are dylib-independent (forced-absent via env); asserts use the real `KnapsackResult` shape (`status`/`value`/`choices[].optionId` — no phantom `.weight` field).
- **Hygiene:** no `target/` tracked (`.gitignore` gains `vendor/knapsack/native/target/`; the stray working-tree `target/` is untracked and ignored); `Cargo.lock` committed (zero-dep crate); working tree clean at 667dd52; `node_modules/@connectotron/knapsack` byte-identical to `vendor/` for all touched files; dylib is Mach-O arm64 exporting `_knapsack_dp`.

## Required before merge

1. C1: i32-range guard in `solveDpNative` (fallback on out-of-range weight/profit) + in-kernel input validation returning an error rc + regression test with the 2³¹-weight repro.
2. M1: `native/README.md` with dylib build recipe, toolchain pin, and checksum.

Recommended (non-blocking): minors 1, 2, 6.

## Round 2 resolution (author, 2026-08-24)

**C1 (critical) — fixed at the root, beyond the reviewer's suggested shape.**
Reviewer reproduced: out-of-i32 weight (2^31+100) passes validateProblem,
truncates negative in the Int32Array flatten, SIGABRTs via panic=abort
(g0 placement) or corrupts silently (g1). Suggested fix (native guard ->
null -> soa fallback) turned out to be INSUFFICIENT on live probe: SoA
itself truncates the same input class (Int32Array flatW/groupMax, dp-soa.ts
lines 33-60) and returns value:-1 "infeasible" where reference D&C returns
5. Root fix: exact scale filter in solve.ts before the DP — options with
weight > capacity are dropped (provably never in a feasible selection;
capacity validated <= 2^21-1, so survivors fit i32; profits already bounded
< 2^31 by MAX_TOTAL_PROFIT). All three kernels now agree on the C1 shapes:
ref 5 = soa 5 = native 5, ids match; 300-problem junk-option sweep 0
mismatches. Defense in depth retained: in-kernel validation (rc -3:
negative n/capacity/weights/profits, non-monotone group_start) + panic
containment (unwind + catch_unwind at the FFI edge, rc -4) + rebuilt
prebuilt dylib (349840 B). Discrimination proof: old dylib vs g0 input
SIGABRTs (exit -6, "index out of bounds" at lib.rs:115); new dylib returns
rc -3. Regression tests in BOTH suites: C1 g1-placement and g0-placement
(reference-vs-native identity).

**M1 — fixed.** native/prebuilt/PROVENANCE.md: rebuild recipe, toolchain
(rustc 1.95.0), sha256 checksum (619d097cd604...f26f1b), rc conventions,
RUSTFLAGS policy.

**Minors:** vendor tsc originalCount fixed (both generators); kernel
50 MiB backstop documented in lib.rs (TS loader enforces caller budget;
C ABI carries no byte param — the triplicated constant is now 3 documented
sights, not silent drift); countCells parity note stands as documented.
CI-native-path and x86_64 prebuilt remain follow-ups (unchanged).

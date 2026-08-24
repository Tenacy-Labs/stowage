# Independent Code Review — Phase 3 Sequence Position

**Reviewed:** `feature/sequence-position` at `59ed387c5e5908e675f4de1439b7791dec1717ec` against `main` at `0843ebf1afbad1d30c19695f53056fb1d21edf95`  
**Scope:** 9 changed files, +778/-68  
**Verdict:** **NOT MERGE-READY**  
**Severity summary:** 0 critical, **4 major**, 3 minor

The core direction is sound: sequence metadata is optional, option metadata overrides item metadata, deltas remain independent items, the planner uses prefix differences for O(1) bill queries, tie-breaking is explicit, no random search was introduced, diagnostics and regret rows are present, and the exact MCKP engine has only one call site. However, four contract-affecting defects remain.

## Major findings

### MAJOR-1 — Accepted ADR's normalization complexity claim is false; the implementation is O(n²)

**Files/lines:**
- `src/sequence-position.ts:67-77`
- `docs/adr/0001-sequence-position-semantics.md:65-67`

`normalizeSequenceOrder()` removes each delta with `splice`, then for every delta scans the entire remaining array to locate its zone tail and inserts with another `splice`. With `d = Θ(n)`, both the nested scan and repeated array shifts are Θ(n²). This contradicts the accepted ADR's statement that canonical sorting and precedence normalization remain O(n log n).

The move-pass preprocessing itself is genuinely O(n) (`src/sequence-position.ts:159-185`) and each bill query is O(1) (`:196`), but candidate ranking sorts up to O(n) candidates (`:206-212`), and the preceding normalization is quadratic. Therefore the narrower “O(1) candidate pricing” claim is true; the overall placement-complexity narrative is not.

**Reproduction/inspection:**

```sh
git grep -nE 'for \(|\.splice\(' 59ed387 -- src/sequence-position.ts
```

Observe the per-delta loop at line 71 containing the full-array loop at line 74 plus `splice` at line 77; line 68 also repeatedly shifts the array.

**Required before merge:** Implement linear bucketing/reassembly (plus sorting only where required), or amend the accepted ADR and explicitly accept/test the quadratic bound. Given the phase-3 contract, the former is preferred.

---

### MAJOR-2 — `capped` can be false even though the five-pass cap leaves an immediately acceptable move pending

**File/lines:** `src/sequence-position.ts:229-234`

On pass five, `capped` is inferred from the number of candidates accepted **before** the fifth move. The planner does not recompute after that move. A fifth move can lower another candidate's intervening bill and make it acceptable; if only the selected candidate was acceptable before the move, line 233 reports `capped: false` even though a sixth move is ready.

**Reproduction:** An isolated review script at `/private/tmp/phase3-review-repros.ts` constructs six nested base/delta families where each accepted move removes 10 tokens from the next candidate's bill:

```sh
cd /private/tmp/stowage-phase3-review
bun /private/tmp/phase3-review-repros.ts
```

Observed output:

```text
CAP_REPRO {"first":{"movePasses":5,"capped":false,"acceptedMoves":5,...},
"second":{"movePasses":2,"capped":false,"acceptedMoves":1,...}}
```

Calling the planner again accepts the pending sixth move, proving the first result stopped because of the cap, not convergence.

**Impact:** `SolverResult.capped`, the primary convergence diagnostic, is false-negative. Operational cap-rate monitoring and defect detection are unreliable.

**Required before merge:** After the fifth accepted move, recompute whether any accepted candidate remains (or conservatively mark capped whenever pass five accepts and prove quiet convergence separately). Add the cascade regression test.

---

### MAJOR-3 — Topological repair can move entries out of their zone-tail/legal ordering

**File/lines:** `src/sequence-position.ts:81-95`

The topological repair records slots without their zones, sorts a family, then writes different family entries into those slots. Because each entry's zone comes from its own chosen option, swapping values across slots can invert global zone order and remove a delta from its own zone-tail branch point.

**Reproduction:** `/private/tmp/phase3-review-repros.ts` creates an evolving base and a foundational delta with `delta.predecessorId = base`:

```sh
cd /private/tmp/stowage-phase3-review
bun /private/tmp/phase3-review-repros.ts
```

Observed:

```text
ZONE_REPRO [{"id":"base","zone":"evolving"},{"id":"delta","zone":"foundational"}]
```

The final layout puts an evolving item before a foundational item. The foundational delta is not at the foundational zone tail. This contradicts ADR-0001 lines 42-45 and the implementation comment at `src/sequence-position.ts:52-55`.

**Impact:** Independent base/delta options may legally choose different zones, but precedence repair can produce a layout that is neither canonical by zone nor at the promised zone-tail branch point.

**Required before merge:** Define the precedence-versus-zone rule for cross-zone lineages and enforce it without assigning entries to slots belonging to another zone. Reject impossible metadata explicitly if precedence is not allowed to cross zones. Add a cross-zone test.

---

### MAJOR-4 — Partial wall-clock metadata disables valid turn-TTL fallback in solver suffix pricing

**File/lines:** `src/solver.ts:759-777`

`hasWallEvidence` becomes true whenever `blockWriteWallTimeMs` exists, even when the relevant suffix entries are `undefined`. That globally disables `turnExpired`. Meanwhile, `wallBlocksExpired` requires every relevant wall timestamp to be defined and expired. Thus an array with missing relevant stamps is treated as usable wall evidence but cannot establish expiration, and expired turn stamps are ignored.

This violates the contract: wall time should win when usable stamps exist; otherwise turns are the fallback.

**Reproduction:** `/private/tmp/phase3-review-repros.ts` prices a rewritten 100-token first block with a 200-token suffix. Turn stamps are expired. The relevant wall stamp is absent:

```sh
cd /private/tmp/stowage-phase3-review
bun /private/tmp/phase3-review-repros.ts
```

Observed:

```text
TTL_REPRO {"noWallCost":0.30000000000000004,"partialWallCost":0.8400000000000001}
```

The same expired suffix costs 0.30 (own rewrite only) without the partial wall array but 0.84 with `[0, undefined]`; the missing wall stamp suppresses the valid turn fallback and adds the suffix spread.

**Required before merge:** Decide wall/turn freshness per relevant block (or require complete usable wall evidence before suppressing turn fallback). Add solver-level tests for partial wall stamps and both transaction-cost/shared-credit paths.

## Minor findings

### MINOR-1 — The nine new tests discriminate as a suite, but not all nine are independently meaningful against pre-phase-3

**File/lines:** `test/sequence-position.test.ts:1-191`

Copying the exact test file to `0843ebf` and running it fails during module loading because `interveningMoveMass` is not exported:

```sh
cd /private/tmp/stowage-red
bun test test/sequence-position.test.ts
```

Observed: `Export named 'interveningMoveMass' not found`, 0 tests executed. Therefore the **suite** unquestionably fails on pre-phase-3, but this run does not prove all nine assertions independently discriminate.

By inspection, eight cases have phase-3-specific expectations and would fail or be unavailable on old code. The final turn-fallback test (`:184-190`) is not independently discriminating: it updates and checks in the same turn, so the legacy turn-only model also returns a hit. It does not test turn expiration. Coverage is also missing for:

- option metadata overriding item metadata;
- cross-zone precedence and precedence after multiple moves;
- deterministic surplus/id tie-breaking across insertion orders;
- the false-negative cap cascade above;
- partial wall-clock stamps and solver TTL pricing;
- direct evidence that exact relief calls MCKP no more than once;
- metadata-free placement equivalence, not merely two repeated feature solves.

The existing cap test (`:139-153`) catches only the case where more than one candidate is already acceptable before pass five, which is why MAJOR-2 passes unnoticed.

---

### MINOR-2 — No auditable RED-GREEN sequence exists in Git history

**Evidence:** `git log 0843ebf..59ed387` contains one commit that adds tests and production code together. The feature reflog shows branch creation followed by the single implementation commit. An exact copy of the new test exists untracked in `/private/tmp/stowage-red`, and running it red against the baseline proves test discrimination at review time, but its timestamp is after the implementation commit and it is not durable history evidence.

This does not prove TDD was not followed; it means RED-GREEN discipline cannot be verified from the submitted history. Preserve a red test commit/run artifact in future phase submissions.

---

### MINOR-3 — Sequence metadata has no validation; pathological precedence chains can exhaust the call stack

**File/lines:** `src/sequence-position.ts:98-119`

`precedenceOrder()` is recursive and accepts arbitrary producer edges. A 200,000-member lineage whose ascending members point to the next member throws `RangeError: Maximum call stack size exceeded` under Bun. Cycles are silently tolerated at line 107 rather than rejected, so malformed metadata can also produce an order that satisfies no meaningful precedence contract.

**Reproduction:**

```sh
cd /private/tmp/stowage-phase3-review
bun /private/tmp/phase3-stack-repro.ts
# STACK_REPRO RangeError: Maximum call stack size exceeded
```

Expected production sizes are far smaller and ADR-0001 explicitly leaves producer-side validation out of scope, so this is minor rather than a merge blocker/security critical. An iterative topological pass plus validation of finite ordinals, same-parent predecessors, missing predecessors, and cycles would harden this boundary.

## Contract verification

| Contract area | Result |
|---|---|
| Optional sequence metadata; independent delta items; option override | Implemented and backward-compatible at the type/API level. |
| Per-parent precedence | Implemented for normal same-zone acyclic lineages; cross-zone repair is defective (MAJOR-3). |
| O(n) move-pass preprocessing / O(1) mass query | Confirmed at `src/sequence-position.ts:159-196`. Overall normalization is O(n²) (MAJOR-1); candidate ranking is O(n log n). |
| Deterministic tie-breaking / no random search | Confirmed explicit surplus then code-unit id sort; no `Date.now`, `Math.random`, UUID, locale collation, network, or stochastic search in changed runtime code. |
| File-migration credit-vs-bill fuse | Implemented as `credit >= intervening bill`; exact-token threshold and regret rows pass. |
| Diagnostics / quiet path / ≤1 MCKP | Fields are present; quiet path is one pass; `solveMckp` has one call site and one conditional invocation. `capped` is defective (MAJOR-2). |
| Dual-axis TTL / helpers | CacheModel wall-vs-turn behavior and breakpoint helpers exist; solver fallback is defective for partial wall evidence (MAJOR-4). |
| Regret ledger / rejected moves / thrash | Implemented for evaluated threshold-rejected and selected accepted moves; reversal signal passes. |
| Backward compatibility | No original tests were modified. All 633 original tests pass on baseline and all 642 tests pass on the feature. New result fields are additive. |
| Security | No eval/process/network/filesystem additions; SHA-256 digest behavior unchanged; `bun audit` reports no vulnerabilities. Metadata validation/recursive availability risk noted in MINOR-3. |

## Verification performed

All release commands were run from detached worktree `/private/tmp/stowage-phase3-review` at `59ed387` after `bun install --frozen-lockfile`:

```text
bunx tsc --noEmit
exit 0

bun test
642 pass, 0 fail, 6327 expect() calls, 4 files
```

Original tests only on `0843ebf`:

```text
bun test test/port.test.ts vendor/knapsack/test/solver.test.ts vendor/knapsack/test/validation.test.ts
633 pass, 0 fail, 6311 expect() calls, 3 files
```

Other checks:

```text
git diff --check 0843ebf..59ed387   # clean
bun audit                            # No vulnerabilities found
```

An initial feature-worktree test/typecheck attempt before dependency installation failed because the fresh detached worktree had no `node_modules`; after the lockfile-frozen install, both canonical gates passed as shown above.

## Merge readiness

**Do not merge `59ed387` as-is.** Resolve MAJOR-1 through MAJOR-4 and add regressions for the cap cascade, cross-zone legality, and partial-wall fallback. Then rerun strict TypeScript and all 642+ tests. The existing design can likely be retained; the blockers are localized to normalization, cap detection, and TTL evidence selection.

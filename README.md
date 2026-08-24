# @connectotron/stowage

**The context-layout solver: what to keep, how to render it, and where it
sits — decided jointly, priced honestly, deterministically.**

`stowage` plans an LLM context window the way a cargo officer plans a
hold: under a tonnage budget (the token window), each crate has
configurations (render options), *where* a crate sits determines
stability (provider cache-prefix continuity), shifting cargo mid-voyage
costs real money (transaction costs), and the plan is revised at each
port of call (every turn).

## What it is

A **price-coupled decomposition** over three axes with different
mathematical characters:

| Axis | Subproblem | Mechanism |
|---|---|---|
| Representation | pick one render option per item | exact MCKP via `@connectotron/knapsack` |
| Position | where each block sits in the sequence | tree-metric moves, prefix-sum priced, greedy tree-shaping |
| Timing | when to move / fuse / restructure | threshold policies with accumulated evidence (anti-Zeno) |

The axes are coupled by **prices**, not by a single monolithic paradigm:
the budget dual, the shared suffix bill, and continuation value. The
honesty check is an offline exact audit on small slices
(optimality-gap reporting), not a trust-me heuristic.

## Constitutional constraints

- **Deterministic** — identical inputs produce identical layouts; replays
  re-derive decisions. No stochastic search in the solve path.
- **Attribution-ready** — per-item margins and rejected moves are
  first-class outputs, not afterthoughts.
- **Provider-honest** — cache economics model billing geometry (prefix
  chains, billing quanta, dual-axis TTL), not wishful thinking.

## Repository boundary

| Repo | Owns |
|---|---|
| `knapsack` (sibling) | the pure integer MCKP engine (math contracts) |
| `stowage` (this repo) | the layout solver: selection × placement × timing |
| `agent-kernel` (private) | the option surface, value semantics, beliefs, ledger — the WHAT |

Extracted from agent-kernel's optimizer (ADR-0005 lineage) as the
phase-3 sequence axis made it a standalone component reusable by other
harnesses. Founding rulings: [ADR-0000](docs/adr/0000-charter.md).

## Performance

The solver is exact by default. Nothing below changes an answer a user of
the default options could observe — the perf work attacks only the
over-budget regime, where exact relief previously stalled for tens of
seconds.

**What shipped (2026-08-24, PR #3, three review rounds):**

- **SoA DP kernel** (`dpKernel: "soa"`, opt-in): structure-of-arrays
  back-pointer DP — 1.2–1.4x on typical windows; byte-identical outputs
  (350 + 400 problem differential suites; the 400-problem suite runs in CI
  via `test/dp-soa.test.ts`).
- **Bounded relief mode** (automatic above the 50 MiB DP budget): the
  exact divide-and-conquer fallback cost 36–38 s at 10k groups / 900k
  window (measured counterfactuals). Bounded mode returns a feasible
  incumbent + a certified interval `[greedyLower, lpUpper]` in ~1.7 s
  local / ~10 s CI — a ~20x improvement, never claiming optimality
  (status `"bounded"`). Measured gap on the full-window test: 0.0055%.
  Certification was itself reviewed: the round-2 reviewer caught `lpUpper`
  able to fall below OPT on non-convex shapes (84 < 98) — fixed to
  `max(hull LP, walk break)`, property-verified 0/8,758 violations, with a
  machine-generated discriminating regression test.

**Explored and rejected: int16 representation** (docs/spikes/001-int16):
profits are `utility × 1000` (SCALE at the relief call site); a single
option at utility 50 = 50,000 > int16 max 32,767, and accumulated DP
values at 10k groups reach 100–500M. Even in a rigged valid regime the
rigged-best-case run produced 6.3M overflows, the wrong answer, and ran
slower than int32 (48 vs 29 ms). int32 is the correctness floor.

**Validated, deferred: Rust FFI kernel** (docs/spikes/002-rust-dp-ffi):
an exact mirror of the SoA kernel as a Rust cdylib via `bun:ffi`.
Differential: 400 problems, byte-identical. Wins concentrated where TS
cannot go: memory-freedom regime 9.6x (tie-heavy 200k: 6 ms vs 53 ms
divide-and-conquer); the wall shape 5k groups × 200k: 0.8 s vs 2.4 s
(3.1x, via a 1 GB back-pointer table — production form would port
Hirschberg D&C for O(capacity) memory). Shared-budget regime only
1.3–1.4x — not worth an FFI dependency there. Decision pending: land in
the knapsack repo as the over-budget path with TS as differential oracle.

## Status

**v0.1.0 — solver ported, sequence axis landed.** The full ex-agent-kernel
solve core (selection, suffix pricing, horizons, evidence, cache model,
params, contract types — ~1,500 lines) runs here, byte-identical, over the
vendored `@connectotron/knapsack`; agent-kernel consumes it via
`file:vendor/stowage` re-export shims (its 869-test suite remains the
port's acceptance test).

[ADR-0001](docs/adr/0001-sequence-position-semantics.md) — the sequence
position axis — has landed: sequence-aware normalization (canonical
zone-order, zone-local topological repair), fuse-move planning with
capped passes and reversal tracking, and per-block TTL evidence on both
the transaction-cost and shared-bill paths. 651 tests, strictest tsc,
two independent review gates. [ADR-0002](docs/adr/0002-solver-port.md)
records the original port. License: pending owner ruling.

## Development

Bun + strictest tsc (house pattern).

```sh
bun install
bunx tsc --noEmit
bun test
```

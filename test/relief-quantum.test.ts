// Full-window (1M-token) over-budget relief: fast, feasible, deterministic.
// Pins the realistic relief geometry (keep/tombstone/evict, few options per
// group): LP+fathom pre-processing resolves most groups before the DP, so
// the exact path completes in ~20ms at 10k items / 10M tokens of content.
// The pathological all-tied geometry (15.2B DP cells, ~42s) is documented in
// bench/relief-dp.ts; quantization is the standing answer if it ever goes
// live — see SolveOptions.dpKernel and the bench file.
import { describe, expect, test } from "bun:test";
import { solve, paramSetV1 } from "../src/index.ts";
import type { ContextItem } from "../src/index.ts";

function buildItems(n: number, tok: number): Map<string, ContextItem> {
  const items = new Map<string, ContextItem>();
  for (let i = 0; i < n; i++) {
    const options = [
      { id: "full", purelyAdditive: true, zones: ["evolving"], representation: "AS_IS", tokens: tok, text: "i" + i },
      { id: "trim", purelyAdditive: false, zones: ["evolving"], representation: "AS_IS", tokens: Math.floor(tok * 0.7), text: "i" + i + "t" },
    ];
    items.set("i" + i, { id: "i" + i, kind: "reference", immutable: false, tokens: tok, serialize: () => "i" + i, options: () => options, lastTouchTurn: 0, createdTurn: 0 } as unknown as ContextItem);
  }
  return items;
}

describe("relief quantization at full window", () => {
  test("1M-window over-budget relief completes, feasible, deterministic", () => {
    const n = 10_000, tok = 1_000;
    const items = buildItems(n, tok); // 10M tokens of content
    const ps = paramSetV1("q");
    ps.budgetLambda = 900_000; // 10% over-budget pressure at a 1M window
    ps.cache.ttlTurns = 4; ps.cache.ttlMs = undefined as unknown as number;
    const inc = { rendered: new Map(), totalTokens: 0, blockCount: 0 };
    const t0 = performance.now();
    const r1 = solve(items, inc, ps, 12, 1000);
    const ms = performance.now() - t0;
    const r2 = solve(items, { rendered: new Map(), totalTokens: 0, blockCount: 0 }, ps, 12, 1000);
    // Fast enough for a per-turn decision path at the largest window.
    expect(ms).toBeLessThan(2_000);
    // Feasible: kept content within the budget.
    const kept = r1.totalTokens;
    expect(kept).toBeLessThanOrEqual(ps.budgetLambda);
    // Deterministic: identical inputs -> identical decisions.
    expect(r2.totalTokens).toBe(r1.totalTokens);
    expect(r2.placements).toEqual(r1.placements);
  });
});

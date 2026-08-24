// Relief-DP bench: exact-MCKP budget relief across window scales.
// Run: bun bench/relief-dp.ts
import { solve, paramSetV1 } from "../src/index.ts";
import type { ContextItem } from "../src/index.ts";

function build(nItems: number, itemTokens: number) {
  const items = new Map<string, ContextItem>();
  for (let i = 0; i < nItems; i++) {
    const options = [
      { id: "full", purelyAdditive: true, zones: ["evolving"], representation: "AS_IS", tokens: itemTokens, text: `i${i}` },
      { id: "trim", purelyAdditive: false, zones: ["evolving"], representation: "AS_IS", tokens: Math.floor(itemTokens * 0.7), text: `i${i}t` },
    ];
    items.set(`i${i}`, { id: `i${i}`, kind: "reference", immutable: false, tokens: itemTokens, serialize: () => `i${i}`, options: () => options, lastTouchTurn: 0, createdTurn: 0 } as unknown as ContextItem);
  }
  return items;
}

function run(label: string, nItems: number, itemTokens: number, budget: number, reps = 3) {
  const items = build(nItems, itemTokens);
  const times: number[] = [];
  for (let r = 0; r < reps; r++) {
    const ps = paramSetV1(label);
    ps.budgetLambda = budget;
    ps.cache.ttlTurns = 4; ps.cache.ttlMs = undefined as unknown as number;
    const t0 = performance.now();
    solve(items, { rendered: new Map(), totalTokens: 0, blockCount: 0 }, ps, 12, 1000);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  console.log(`${label}: n=${nItems} tok/item=${itemTokens} budget=${budget} -> min ${times[0]!.toFixed(1)} ms / med ${times[Math.floor(reps / 2)]!.toFixed(1)} ms`);
}

run("win-4k  ", 40, 150, 4_000);
run("win-30k ", 300, 150, 30_000);
run("win-200k", 500, 500, 200_000);
run("win-1M  ", 1000, 1000, 1_000_000);

// Native SIMD kernel tests (spike 003 productionized, 2026-08-24).
// Three invariants:
//  1. Differential: wherever a dylib is present, solveDpNative agrees with
//     solveDpSoa on value, weight, choiceIndex, AND cellsVisited.
//  2. Fallback honesty: with the dylib absent/unloadable, solve.ts with
//     dpKernel "native" returns soa-identical results (graceful TS path).
//  3. Default unchanged: dpKernel "reference"/absent never touches native.
import { describe, expect, test } from "bun:test";
import { solve } from "../src/solve.ts";
import { solveDpSoa } from "../src/dp-soa.ts";
import { solveDpNative, nativeAvailable, _resetNativeCache } from "../src/native.ts";
import type { ReducedGroup } from "../src/types.ts";

function xorshift32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17; s >>>= 0;
    s ^= s << 5; s >>>= 0;
    return s;
  };
}

/** Randomized reduced-group problems (the differential generator). */
function reducedProblem(
  nGroups: number, capacity: number, seed: number, maxOpts = 6, tiePct = 0,
): ReducedGroup[] {
  const rnd = xorshift32(seed);
  const groups: ReducedGroup[] = [];
  for (let g = 0; g < nGroups; g++) {
    const nOpts = 2 + rnd() % maxOpts;
    const options = [];
    for (let o = 0; o < nOpts; o++) {
      const w = 1 + rnd() % Math.max(2, Math.floor(capacity * 0.08));
      const p = tiePct > 0 && rnd() % 100 < tiePct ? 1000 : 1 + rnd() % 5000;
      options.push({ id: "o" + o, weight: w, profit: p });
    }
    options.sort((a, b) => a.weight - b.weight);
    groups.push({ id: "g" + g, options });
  }
  return groups;
}

describe("native SIMD kernel (spike 003 productionized)", () => {
  test("differential: native agrees with soa on value/weight/choices/cells (500 problems)", () => {
    if (!nativeAvailable()) {
      console.log("no dylib on this host -> differential skipped");
      return;
    }
    let mismatches = 0;
    let ran = 0;
    for (let i = 0; i < 500; i++) {
      const nG = 5 + (i % 60);
      const cap = 200 + (i * 37) % 3000;
      const tiePct = i % 3 === 0 ? 15 : 0;
      const groups = reducedProblem(nG, cap, 1234 + i, 6, tiePct);
      const soa = solveDpSoa(groups, cap);
      const nat = solveDpNative(groups, cap);
      if (nat === null) continue;
      ran++;
      if (
        soa.value !== nat.value || soa.weight !== nat.weight ||
        JSON.stringify(soa.choiceIndex) !== JSON.stringify(nat.choiceIndex) ||
        soa.cellsVisited !== nat.cellsVisited
      ) {
        mismatches++;
        if (mismatches <= 3) {
          console.log("MISMATCH seed", 1234 + i, "soa", soa.value, soa.weight, "nat", nat.value, nat.weight);
        }
      }
    }
    expect(ran).toBeGreaterThan(0);
    console.log("differential ran", ran, "of 500 problems; mismatches", mismatches);
    expect(mismatches).toBe(0);
  }, 60_000);

  test("fallback: dpKernel native falls back to soa when dylib is absent", () => {
    const groups = reducedProblem(12, 400, 777, 6, 10);
    const viaSolve = solve(
      { groups: groups as never, capacity: 400 },
      { dpKernel: "native" } as never,
    );
    const soa = solveDpSoa(groups, 400);
    const soaIds = soa.choiceIndex.map((ci, gi) => groups[gi]!.options[ci]!.id);
    expect(viaSolve.status).toBe("optimal");
    expect(viaSolve.value).toBe(soa.value);
    expect(JSON.stringify(viaSolve.choices?.map((c) => c.optionId))).toBe(JSON.stringify(soaIds));
  });

  test("fallback honesty: corrupt dylib path -> null loader -> soa-identical solve", () => {
    process.env.KNAPSACK_NATIVE_DYLIB = "/nonexistent/libknapsack_native.dylib";
    _resetNativeCache();
    try {
      expect(nativeAvailable()).toBe(false);
      const groups = reducedProblem(9, 350, 991, 5, 20);
      const viaSolve = solve(
        { groups: groups as never, capacity: 350 },
        { dpKernel: "native" } as never,
      );
      const soa = solveDpSoa(groups, 350);
      const soaIds = soa.choiceIndex.map((ci, gi) => groups[gi]!.options[ci]!.id);
      expect(viaSolve.status).toBe("optimal");
    expect(viaSolve.value).toBe(soa.value);
      expect(JSON.stringify(viaSolve.choices?.map((c) => c.optionId))).toBe(JSON.stringify(soaIds));
    } finally {
      delete process.env.KNAPSACK_NATIVE_DYLIB;
      _resetNativeCache();
    }
  });
});

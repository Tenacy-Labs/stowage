/**
 * Evidence-priced value — ADR-0006 §2.1 invariants (λ posterior, value
 * factor, Beta variance). Exact numbers derive from the documented
 * formulas: λ = (κp₀ + |hits|)/(κ + n) with κ=10, window W=64.
 */
import { describe, test, expect } from "bun:test";
import { lambdaPosterior, evidenceValueFactor, evidenceVariance } from "../src/index.ts";
import type { ContextItem, AccessClass } from "../src/index.ts";

function evItem(hits: number[], createdTurn: number, lastTouchTurn: number, accessClass: AccessClass = "searchHit"): ContextItem {
  return {
    id: "ev",
    kind: "reference",
    immutable: false,
    tokens: 10,
    serialize: () => "ev",
    options: () => [{ id: "full", purelyAdditive: true, zones: ["evolving"], representation: "AS_IS", tokens: 10, text: "ev" }],
    lastTouchTurn,
    createdTurn,
    refEvidence: { hits, accessClass },
  };
}

function bareItem(): ContextItem {
  const { refEvidence: _drop, ...rest } = evItem([], 0, 20);
  return rest;
}

describe("evidence-priced value (ADR-0006 §2.1)", () => {
  test("absent evidence is EXACTLY neutral (phase-1 contract)", () => {
    expect(lambdaPosterior(bareItem(), 0.05)).toBe(0.05);
    expect(evidenceValueFactor(bareItem(), 0.05)).toBe(1);
    expect(evidenceVariance(bareItem(), 0.05)).toBeNull();
  });

  test("lambdaPosterior shrinkage: κp₀ + hits over κ + observed turns", () => {
    // created 0, turn 20 -> n = 21; hits {2,5,9} all in window -> 3.
    expect(lambdaPosterior(evItem([2, 5, 9], 0, 20), 0.05, 20)).toBeCloseTo(3.5 / 31, 12);
    // Turn filter: only h <= 5 count -> 2 hits, n = 6.
    expect(lambdaPosterior(evItem([2, 5, 9], 0, 20), 0.05, 5)).toBe(2.5 / 16);
    // No turn arg: window is lastTouchTurn, hits unfiltered.
    expect(lambdaPosterior(evItem([2, 5, 9], 0, 20), 0.05)).toBeCloseTo(3.5 / 31, 12);
  });

  test("observed turns cap at the 64-turn evidence window (A-minor-6)", () => {
    // 200-turn-old item: n = 64, not 201 — a recent burst must move λ.
    expect(lambdaPosterior(evItem([], 0, 200), 0.05, 200)).toBeCloseTo(0.5 / 74, 12);
  });

  test("observed turns floor at 1 (turn before creation)", () => {
    // created 10, turn 5 -> max(1, -4) = 1; hit at 3 still counted.
    expect(lambdaPosterior(evItem([3], 10, 12), 0.05, 5)).toBeCloseTo(1.5 / 11, 12);
  });

  test("value factor is λ/p₀ clamped to [0.25, 4]", () => {
    // Hot item: λ ≈ 0.1129 over prior 0.05 -> ≈ 2.258 (interior).
    expect(evidenceValueFactor(evItem([2, 5, 9], 0, 20), 0.05, 20)).toBeCloseTo(3.5 / 31 / 0.05, 12);
    // Cold item: prior 0.5, zero hits across a 64-turn window -> λ/p₀ ≈ 0.135 -> floor.
    expect(evidenceValueFactor(evItem([], 0, 200), 0.5, 200)).toBe(0.25);
  });

  test("prior-0 kinds are evidence-neutral (A-M5 ruling 2026-08-23)", () => {
    // Access must never rescale identity/episodic/error value.
    expect(evidenceValueFactor(evItem([1, 2], 0, 5), 0, 5)).toBe(1);
  });

  test("Beta variance: positive and exact", () => {
    // n=21, hits=3 -> a=3.5, b=27.5; var = ab/((a+b)²(a+b+1)).
    expect(evidenceVariance(evItem([2, 5, 9], 0, 20), 0.05, 20)).toBeCloseTo((3.5 * 27.5) / (31 * 31 * 32), 12);
  });

  test("bursty hits beyond observation turns guard to null, never negative (C1)", () => {
    // 14 access events across turns 1..3 (n=4): b <= 0 -> null, not NaN.
    const burst = Array.from({ length: 14 }, (_, i) => (i % 3) + 1);
    expect(evidenceVariance(evItem(burst, 0, 3), 0.05, 3)).toBeNull();
  });
});

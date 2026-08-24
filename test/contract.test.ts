import { expect, test } from "bun:test";
import type {
  StowItem,
  StowOption,
  CacheSnapshot,
  PlacementEdge,
} from "../src/index.ts";

/**
 * Boundary contract pin (scaffold stage): the interfaces accept a
 * representative kernel-shaped fixture — a code lens with a late delta,
 * a three-block cache chain with tail mass, and a precedence edge.
 * tsc failing on this file means the boundary broke. Behavioral pins
 * (determinism, move pricing, convergence caps) land with the port
 * slice, per ADR-0001.
 */
test("boundary interfaces accept a kernel-shaped fixture", () => {
  const full: StowOption = { id: "full", tokens: 249 };
  const deltaTail: StowOption = { id: "delta-tail", tokens: 40, purelyAdditive: true };
  const handle: StowOption = { id: "handle", tokens: 10, zeroValue: true };
  const item: StowItem = {
    id: "lens:src/solver.ts",
    kind: "code",
    options: () => [full, deltaTail, handle],
    lastTouchTurn: 12,
    upstreams: ["lens:src/solver.ts#base"],
  };
  const snap: CacheSnapshot = {
    chain: ["d1", "d2", "d3"],
    suffixMass: [0, 0, 40],
    ttlTurns: 4,
    ttlMs: 5 * 60_000,
    pricePer1kCached: 0.1,
    pricePer1kUncached: 1.0,
  };
  const edge: PlacementEdge = { after: item.id };

  expect(item.options().length).toBe(3);
  expect(item.upstreams?.[0]).toBe("lens:src/solver.ts#base");
  expect(snap.suffixMass.at(-1)).toBe(40);
  expect(edge.after).toBe(item.id);
  // purelyAdditive and zeroValue are the two flagged option classes;
  // their presence on the fixture is the contract the solver relies on.
  expect(deltaTail.purelyAdditive).toBe(true);
  expect(handle.zeroValue).toBe(true);
});

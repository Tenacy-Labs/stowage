// End-to-end consumer: proves the SHIPPED ARTIFACT works, not just the
// repo checkout. Runs in two contexts:
//   - locally: `bun e2e/consumer.ts` — "@tenacy-labs/stowage" resolves by
//     self-reference through the package exports field;
//   - in CI: the repo is packed with `bun pack`, the tarball installed in
//     a scratch project (re-resolving the @tenacy-labs/knapsack git
//     dependency), and this file copied in — so the import is the packed
//     artifact exactly as a consumer receives it.
//
// Assertions target public-API truths: budget feasibility, placement
// validity, ledger journaling, determinism.
import {
  solve,
  paramSetV1,
  ZONE_ORDER,
  type ContextItem,
  type SolverResult,
} from "@tenacy-labs/stowage";

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(`E2E FAIL: ${msg}`);
}

function item(id: string, tokens: number, lastTouchTurn: number): ContextItem {
  const text = `${id}-${"x".repeat(tokens * 4)}`;
  return {
    id,
    kind: "reference",
    immutable: false,
    tokens,
    serialize: () => text,
    options: () => [
      { id: "full", purelyAdditive: true, zones: ["evolving"], representation: "AS_IS", tokens, text },
      {
        id: "trim",
        purelyAdditive: false,
        zones: ["evolving"],
        representation: "AS_IS",
        tokens: Math.floor(tokens * 0.6),
        text: text.slice(0, Math.floor(text.length * 0.6)),
      },
    ],
    lastTouchTurn,
    createdTurn: Math.max(0, lastTouchTurn - 3),
  };
}

function scenario(): Map<string, ContextItem> {
  // Mixed value: hot recent items, mid-age, stale — decay must
  // differentiate them at solve time.
  return new Map<string, ContextItem>([
    ["doc:hot", item("doc:hot", 300, 39)],
    ["doc:mid", item("doc:mid", 200, 30)],
    ["doc:old", item("doc:old", 150, 10)],
    ["code:hot", item("code:hot", 400, 38)],
    ["code:old", item("code:old", 350, 5)],
    ["memo:fresh", item("memo:fresh", 80, 40)],
  ]);
}

function checkInvariants(label: string, r: SolverResult, budget: number): SolverResult {
  assert(r.placements.length > 0, `${label}: no placements`);
  assert(r.totalTokens <= budget, `${label}: budget violated — ${r.totalTokens} > ${budget}`);
  const positions: number[] = [];
  for (const p of r.placements) {
    assert(ZONE_ORDER.includes(p.zone), `${label}: bad zone ${p.zone}`);
    assert(p.position >= 1, `${label}: bad position ${p.position}`);
    assert(p.tokens > 0, `${label}: non-positive tokens for ${p.id}`);
    positions.push(p.position);
  }
  assert(new Set(positions).size === positions.length, `${label}: duplicate positions`);
  for (const led of r.itemLedgers) {
    assert(led.decision !== undefined, `${label}: ledger missing decision for ${led.id}`);
  }
  console.log(`${label}: ${r.placements.length} placements, ${r.totalTokens}/${budget} tokens, ${r.itemLedgers.length} ledgers`);
  return r;
}

const FRESH = { rendered: new Map(), totalTokens: 0, blockCount: 0 };

// 1. Comfortable budget — everything fits, invariants hold.
const comfyBudget = 4_000;
const comfyPs = paramSetV1("e2e");
comfyPs.budgetLambda = comfyBudget;
const comfy = checkInvariants("comfortable", solve(scenario(), FRESH, comfyPs, 40), comfyBudget);
assert(comfy.placements.length === 6, `comfortable: expected 6 placements, got ${comfy.placements.length}`);

// 2. Tight budget — relief must keep the window feasible, not capped out.
const tightBudget = 400;
const tightPs = paramSetV1("e2e");
tightPs.budgetLambda = tightBudget;
checkInvariants("tight", solve(scenario(), FRESH, tightPs, 40), tightBudget);

// 3. Determinism — identical inputs, byte-identical result.
assert(
  JSON.stringify(solve(scenario(), FRESH, comfyPs, 40)) === JSON.stringify(comfy),
  "determinism: identical inputs produced different results",
);

console.log("E2E PASS");

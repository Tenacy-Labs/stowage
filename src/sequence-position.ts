/** Deterministic phase-3 sequence-position placement (ADR-0001). */
import type { ContextItem, ItemLedger, RenderOption, SequencePosition, Zone } from "./types.ts";

export const MAX_MOVE_PASSES = 5;

export interface PriorMove {
  fromPosition: number;
  toPosition: number;
}

export interface PositionEntry {
  item: ContextItem;
  option: RenderOption;
  utility: number;
}

export interface MoveDiagnostics {
  movePasses: number;
  capped: boolean;
  acceptedMoves: number;
  reversals: number;
  moveThrash: boolean;
}

function sequenceOf(entry: PositionEntry): SequencePosition | undefined {
  return entry.option.sequence ?? entry.item.sequence;
}

/**
 * Prefix-mass preprocessing is O(n). A candidate move crosses the blocks
 * strictly between its old slot and target branch point, queried in O(1).
 * `target` is a boundary in the original array, in [0, masses.length].
 */
export function interveningMoveMass(
  masses: readonly number[],
  from: number,
  target: number,
): number {
  if (from < 0 || from >= masses.length || target < 0 || target > masses.length) return 0;
  const prefix = new Array<number>(masses.length + 1).fill(0);
  for (let i = 0; i < masses.length; i++) prefix[i + 1] = prefix[i]! + masses[i]!;
  return interveningFromPrefix(prefix, from, target);
}

function interveningFromPrefix(prefix: readonly number[], from: number, target: number): number {
  if (target > from) return prefix[target]! - prefix[from + 1]!;
  if (target < from) return prefix[from]! - prefix[target]!;
  return 0;
}

/**
 * Establish legal representative ordering before priced moves:
 * - non-sequence blocks retain canonical order;
 * - each lineage is in ordinal/id order (explicit precedence);
 * - unfused deltas occupy their zone-tail/radix branch point.
 */
export function normalizeSequenceOrder(
  entries: PositionEntry[],
  zoneOf: (entry: PositionEntry) => Zone,
): void {
  const deltas = entries.filter((entry) => {
    const sequence = sequenceOf(entry);
    return sequence?.role === "delta" && sequence.placement !== "fuse";
  });
  if (deltas.length > 0) {
    const deltaSet = new Set(deltas);
    for (let i = entries.length - 1; i >= 0; i--) {
      if (deltaSet.has(entries[i]!)) entries.splice(i, 1);
    }
    deltas.sort(sequenceCompare);
    for (const delta of deltas) {
      const zone = zoneOf(delta);
      let target = entries.length;
      for (let i = 0; i < entries.length; i++) {
        if (zoneOf(entries[i]!) === zone) target = i + 1;
      }
      entries.splice(target, 0, delta);
    }
  }

  // Stable topological repair: sequence members keep their occupied slots,
  // while values placed in those slots are sorted by per-parent precedence.
  const byParent = new Map<string, { slots: number[]; values: PositionEntry[] }>();
  for (let i = 0; i < entries.length; i++) {
    const sequence = sequenceOf(entries[i]!);
    if (sequence === undefined) continue;
    const family = byParent.get(sequence.parentId) ?? { slots: [], values: [] };
    family.slots.push(i);
    family.values.push(entries[i]!);
    byParent.set(sequence.parentId, family);
  }
  for (const family of byParent.values()) {
    const ordered = precedenceOrder(family.values);
    for (let i = 0; i < family.slots.length; i++) entries[family.slots[i]!] = ordered[i]!;
  }
}

/** Deterministic DFS topological order over each member's optional edge. */
function precedenceOrder(values: PositionEntry[]): PositionEntry[] {
  const sorted = [...values].sort(sequenceCompare);
  const byId = new Map(sorted.map((entry) => [entry.item.id, entry] as const));
  const visiting = new Set<string>();
  const emitted = new Set<string>();
  const ordered: PositionEntry[] = [];
  const visit = (entry: PositionEntry): void => {
    if (emitted.has(entry.item.id)) return;
    if (visiting.has(entry.item.id)) return; // malformed cycle: ordinal/id fallback remains deterministic
    visiting.add(entry.item.id);
    const predecessorId = sequenceOf(entry)?.predecessorId;
    const predecessor = predecessorId === undefined ? undefined : byId.get(predecessorId);
    if (predecessor !== undefined) visit(predecessor);
    visiting.delete(entry.item.id);
    if (!emitted.has(entry.item.id)) {
      emitted.add(entry.item.id);
      ordered.push(entry);
    }
  };
  for (const entry of sorted) visit(entry);
  return ordered;
}

function sequenceCompare(a: PositionEntry, b: PositionEntry): number {
  const sa = sequenceOf(a)!;
  const sb = sequenceOf(b)!;
  if (sa.parentId !== sb.parentId) return sa.parentId < sb.parentId ? -1 : 1;
  if (sa.ordinal !== sb.ordinal) return sa.ordinal - sb.ordinal;
  return a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0;
}

interface Candidate {
  entry: PositionEntry;
  from: number;
  target: number;
  bill: number;
  credit: number;
  accepted: boolean;
  reversal: boolean;
}

/**
 * Greedy file-migration planner. Each pass preprocesses prefix/suffix mass in
 * O(n), evaluates every lineage's fuse branch in O(1), and accepts at most one
 * deterministic best move. No random search and no additional selection call.
 */
export function planSequenceMoves(
  entries: PositionEntry[],
  itemLedgers: ItemLedger[],
  turn: number,
  previousMoves: ReadonlyMap<string, PriorMove> | undefined,
): MoveDiagnostics {
  let acceptedMoves = 0;
  let reversals = 0;
  let movePasses = 0;
  let capped = false;
  const rejectedLogged = new Set<string>();

  for (let pass = 0; pass < MAX_MOVE_PASSES; pass++) {
    movePasses += 1;
    const prefix = new Array<number>(entries.length + 1).fill(0);
    const suffix = new Array<number>(entries.length + 1).fill(0);
    for (let i = 0; i < entries.length; i++) prefix[i + 1] = prefix[i]! + entries[i]!.option.tokens;
    for (let i = entries.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1]! + entries[i]!.option.tokens;
    void suffix; // both axes are preprocessed once; candidates use prefix differences.

    // normalizeSequenceOrder guarantees per-parent precedence. One linear
    // scan therefore resolves every member's immediate predecessor; candidate
    // evaluation below is a pair of Map lookups plus an O(1) prefix query.
    const predecessorById = new Map<string, number>();
    const lastByParent = new Map<string, number>();
    const indexById = new Map<string, number>();
    for (let i = 0; i < entries.length; i++) {
      indexById.set(entries[i]!.item.id, i);
    }
    for (let i = 0; i < entries.length; i++) {
      const sequence = sequenceOf(entries[i]!);
      if (sequence === undefined) continue;
      const explicitIndex = sequence.predecessorId === undefined ? undefined : indexById.get(sequence.predecessorId);
      const explicit = explicitIndex !== undefined
        && sequenceOf(entries[explicitIndex]!)?.parentId === sequence.parentId
        ? explicitIndex
        : undefined;
      const predecessor = explicit ?? lastByParent.get(sequence.parentId);
      if (predecessor !== undefined) predecessorById.set(entries[i]!.item.id, predecessor);
      lastByParent.set(sequence.parentId, i);
    }

    const candidates: Candidate[] = [];
    for (let from = 0; from < entries.length; from++) {
      const entry = entries[from]!;
      const sequence = sequenceOf(entry);
      if (sequence?.role !== "delta" || sequence.placement !== "fuse") continue;
      const predecessor = predecessorById.get(entry.item.id);
      if (predecessor === undefined) continue;
      const target = predecessor + 1;
      if (target === from || target === from + 1) continue;
      const bill = interveningFromPrefix(prefix, from, target);
      const credit = Math.max(0, sequence.migrationCreditTokens ?? 0);
      const prior = previousMoves?.get(entry.item.id);
      const proposed = { fromPosition: from + 1, toPosition: target + 1 };
      const reversal = prior !== undefined
        && prior.fromPosition === proposed.toPosition
        && prior.toPosition === proposed.fromPosition;
      candidates.push({ entry, from, target, bill, credit, accepted: credit >= bill, reversal });
    }

    candidates.sort((a, b) => {
      if (a.accepted !== b.accepted) return a.accepted ? -1 : 1;
      const surplusA = a.credit - a.bill;
      const surplusB = b.credit - b.bill;
      if (surplusA !== surplusB) return surplusB - surplusA;
      return a.entry.item.id < b.entry.item.id ? -1 : a.entry.item.id > b.entry.item.id ? 1 : 0;
    });
    const accepted = candidates.find((candidate) => candidate.accepted);

    for (const candidate of candidates) {
      if (candidate.accepted || rejectedLogged.has(candidate.entry.item.id)) continue;
      rejectedLogged.add(candidate.entry.item.id);
      itemLedgers.push(moveLedger(turn, candidate, false));
    }
    if (accepted === undefined) break;

    const [moved] = entries.splice(accepted.from, 1);
    const insertion = accepted.target > accepted.from ? accepted.target - 1 : accepted.target;
    entries.splice(insertion, 0, moved!);
    acceptedMoves += 1;
    if (accepted.reversal) reversals += 1;
    itemLedgers.push(moveLedger(turn, accepted, true));

    if (pass === MAX_MOVE_PASSES - 1) {
      // More than the accepted candidate remains: convergence was not
      // observed before the hard cap. Exactly one candidate means this move
      // completed the work and must not be mislabeled capped.
      capped = candidates.filter((candidate) => candidate.accepted).length > 1;
    }
  }

  return { movePasses, capped, acceptedMoves, reversals, moveThrash: reversals > 0 };
}

function moveLedger(turn: number, candidate: Candidate, accepted: boolean): ItemLedger {
  const regret = candidate.bill - candidate.credit;
  return {
    turn,
    id: candidate.entry.item.id,
    forecast: { mu0: 0, alpha: 0, deltaT: 0, hazard: 0, basis: "prior", expectedValue: candidate.entry.utility },
    utility: { benefit: candidate.entry.utility, cacheCost: 0, rotShare: 0, total: candidate.entry.utility },
    decision: "move",
    accepted,
    marginVsHysteresis: -regret,
    optionChosen: candidate.entry.option.id,
    positionRegret: {
      fromPosition: candidate.from + 1,
      toPosition: candidate.target + 1,
      suffixBillTokens: candidate.bill,
      migrationCreditTokens: candidate.credit,
      regretTokens: regret,
      accepted,
      reversal: candidate.reversal,
      reason: accepted ? "credit-covered" : "insufficient-credit",
    },
    moveThrash: accepted && candidate.reversal,
  };
}

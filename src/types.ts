/**
 * stowage boundary types — v0 sketch.
 *
 * The kernel owns WHAT: the option surface, value semantics, beliefs,
 * the ledger. stowage owns HOW: the price-coupled tradeoff machinery.
 * These types are the seam; ADR-0001 (proposed) stabilizes them.
 */

/** One renderable representation of an item at a token weight. */
export interface StowOption {
  id: string;
  tokens: number;
  /**
   * True when rendering this option can only append bytes at the tail —
   * the KV-cache-preserving path (agent-kernel ADR-0004 A5,
   * backward-consistency ruling). Purely-additive options are how the
   * solver always retains a cache-continuity move.
   */
  purelyAdditive?: boolean;
  /**
   * Handle/tombstone class: zero content, carries the item's future
   * re-reference stream (optionality, priced via continuation value).
   */
  zeroValue?: boolean;
}

/** A layout candidate. Generic over the kernel's ContextItem. */
export interface StowItem {
  id: string;
  /** Policy class (kind) — consumers map kinds to priors/profiles. */
  kind: string;
  options(): readonly StowOption[];
  /** Churn-credit clock anchor (effectiveDeltaT derived consumer-side). */
  lastTouchTurn: number;
  /** Fragment parent (delta → base), for precedence edges. */
  upstreams?: readonly string[];
}

/** Caller's belief about the provider cache after the incumbent render. */
export interface CacheSnapshot {
  /** Block digests in incumbent order — the shared prefix chain. */
  chain: readonly string[];
  /**
   * suffixMass[i] = tokens billed at uncached price if the chain breaks
   * immediately after block i. Prefix-sum form: move pricing is O(1).
   */
  suffixMass: readonly number[];
  /** Dual-axis expiry: turns AND wall-clock (providers expire in minutes). */
  ttlTurns: number;
  ttlMs: number;
  pricePer1kCached: number;
  pricePer1kUncached: number;
}

/** Ordering constraint on placement. */
export interface PlacementEdge {
  /** This item renders after `after` (deltas render in arrival order). */
  after: string;
}

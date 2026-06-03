// Flattens a profile against a vendor inheritance graph.
//
// PrusaSlicer merge semantics (matching the slicer's own preset system):
//   - `inherits = A; B; *base*` is applied left -> right, so a LATER parent
//     overrides an earlier one for the same key.
//   - the profile's OWN keys override all of its parents.
// A key set to `nil` is kept (it means "reset to the printer/global default")
// and is dropped later by the value transform, not here.

import type { VendorGraph } from "../types.js";

export interface FlattenResult {
  /** Fully-resolved key -> value (no `inherits`). */
  settings: Record<string, string>;
  /** Every ancestor whose values were merged in, nearest-last. */
  chain: string[];
  /** Parent names referenced by the graph but not found in it. */
  missing: string[];
}

/**
 * Resolve the complete settings for `parents` + `own`, walking the graph.
 * Works for a profile that lives in the graph (pass its parents/settings) and
 * for an external user profile (pass its `inherits` parents and own settings).
 */
export function flatten(
  graph: VendorGraph,
  parents: string[],
  own: Record<string, string>,
): FlattenResult {
  const acc: Record<string, string> = {};
  const chain: string[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();

  for (const p of parents) mergeParent(graph, p, acc, chain, missing, seen);
  Object.assign(acc, own);
  delete acc["inherits"];
  return { settings: acc, chain, missing };
}

/** Convenience: flatten a profile that exists in the graph by name. */
export function flattenNamed(graph: VendorGraph, name: string): FlattenResult {
  const node = graph.nodes.get(name);
  if (!node) return { settings: {}, chain: [], missing: [name] };
  return flatten(graph, node.parents, node.settings);
}

function mergeParent(
  graph: VendorGraph,
  name: string,
  acc: Record<string, string>,
  chain: string[],
  missing: string[],
  seen: Set<string>,
): void {
  if (seen.has(name)) return; // cycle / diamond — already merged
  seen.add(name);

  const node = graph.nodes.get(name);
  if (!node) {
    if (!missing.includes(name)) missing.push(name);
    return;
  }
  // Resolve this node's own parents first (so it overrides them), left -> right.
  for (const p of node.parents) mergeParent(graph, p, acc, chain, missing, seen);
  Object.assign(acc, node.settings);
  chain.push(name);
}

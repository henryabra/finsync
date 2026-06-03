// Maps a PrusaSlicer preset name to the OrcaSlicer preset that ships the same
// profile, so a converted profile can re-link (`inherits`) to it instead of
// carrying hundreds of inlined values.
//
// Orca's Prusa-vendor naming differs from PrusaSlicer's in predictable ways:
//   "Generic ABS @COREONE HF0.6"  -> "Prusa Generic ABS @CORE One HF 0.6"
//   "Prusament PLA @COREONE HF0.6" -> "Prusament PLA @CORE One HF 0.6"
// We normalize the Prusa name toward Orca's convention, then require an exact
// (case/space-insensitive) hit against the live Orca preset index. No fuzzy
// guessing — a wrong re-link silently breaks a profile, so we'd rather flatten.

import type { OrcaNameIndex } from "../types.js";
import { isAbstract } from "../ingest/vendorBundle.js";

/** Collapse case/whitespace so "CORE  One" and "core one" compare equal. */
export function normalizeForMatch(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

export function buildOrcaNameIndex(names: readonly string[]): OrcaNameIndex {
  const byNormalized = new Map<string, string>();
  for (const n of names) {
    const k = normalizeForMatch(n);
    if (!byNormalized.has(k)) byNormalized.set(k, n);
  }
  return { names, byNormalized };
}

/**
 * Rewrite a Prusa preset name toward Orca's naming convention.
 * Returns null for abstract bases (`*PLA*`) — those never exist in Orca.
 */
export function prusaToOrcaName(name: string): string | null {
  if (isAbstract(name)) return null;
  const at = name.indexOf("@");
  let left = at === -1 ? name.trim() : name.slice(0, at).trim();
  let right = at === -1 ? "" : name.slice(at + 1).trim();

  // Orca prefixes its non-branded generics with "Prusa".
  if (/^Generic\b/i.test(left)) left = `Prusa ${left}`;

  if (right) {
    right = right
      .replace(/COREONE\s*L\b/gi, "CORE One L")
      .replace(/COREONE\b/gi, "CORE One")
      .replace(/HF\s*0\.(\d)/gi, "HF 0.$1") // HF0.6 -> HF 0.6
      .replace(/\s+/g, " ")
      .trim();
  }

  return right ? `${left} @${right}` : left;
}

/**
 * Best-effort exact match of a Prusa preset to an Orca preset.
 * Tries the name as-is and the Orca-normalized rewrite. Returns Orca's
 * canonical (display) name, or null if no confident match exists.
 */
export function matchOrcaProfile(
  prusaName: string,
  index: OrcaNameIndex,
): string | null {
  if (isAbstract(prusaName)) return null;

  const candidates = [prusaName, prusaToOrcaName(prusaName)].filter(
    (c): c is string => !!c,
  );
  for (const c of candidates) {
    const hit = index.byNormalized.get(normalizeForMatch(c));
    if (hit) return hit;
  }
  return null;
}

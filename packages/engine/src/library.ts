// Library mode: convert the system profiles in a PrusaSlicer vendor bundle
// (e.g. every Prusament filament) into Orca profiles.
//
// Each concrete profile is run through the same re-link-or-flatten converter, so
// a profile whose parent Orca already ships stays a tiny diff, while one Orca
// lacks is flattened into a standalone profile. Profiles Orca already ships are
// skipped by default (you already have them); abstract `*base*` profiles never
// emit; an optional printer filter limits output to your machine's variants.

import type {
  VendorGraph,
  VendorNode,
  OrcaNameIndex,
  ConversionResult,
  PrusaProfile,
  ResolutionContext,
} from "./types.js";
import { matchOrcaProfile, normalizeForMatch, prusaToOrcaName } from "./transform/orcaMatch.js";
import { convertFilamentProfile } from "./convertFilament.js";

export interface LibraryOptions {
  /**
   * Keep only profiles whose `@variant` matches one of these tokens
   * (normalized substring), plus variant-less profiles. e.g. ["CORE One HF 0.6"].
   * Omit to convert every concrete profile.
   */
  printerFilter?: string[];
  /** Also emit profiles Orca already ships (default false — you already have them). */
  includeExisting?: boolean;
}

export type LibrarySkipReason =
  | "abstract" // a *base* profile, never user-facing
  | "already-in-orca" // Orca already ships this exact profile
  | "printer-filter"; // doesn't match the requested printer variant

export interface LibraryEntry {
  name: string;
  converted: boolean;
  /** When skipped, why. */
  skipped?: LibrarySkipReason;
  /** When skipped as already-in-orca, the matching Orca preset. */
  orcaMatch?: string;
  result?: ConversionResult;
}

export function convertVendorLibrary(
  graph: VendorGraph,
  orca: OrcaNameIndex,
  opts: LibraryOptions = {},
): LibraryEntry[] {
  const ctx: ResolutionContext = { orca, vendor: graph };
  const filter = opts.printerFilter?.map(normalizeForMatch);
  const out: LibraryEntry[] = [];

  for (const node of graph.nodes.values()) {
    if (node.abstract) {
      out.push({ name: node.name, converted: false, skipped: "abstract" });
      continue;
    }
    if (filter && !matchesPrinter(node.name, filter)) {
      out.push({ name: node.name, converted: false, skipped: "printer-filter" });
      continue;
    }
    const existing = matchOrcaProfile(node.name, orca);
    if (existing && !opts.includeExisting) {
      out.push({ name: node.name, converted: false, skipped: "already-in-orca", orcaMatch: existing });
      continue;
    }
    out.push({
      name: node.name,
      converted: true,
      result: convertFilamentProfile(nodeToProfile(node, graph), ctx),
    });
  }
  return out;
}

/**
 * A variant-less profile matches any printer; otherwise its `@variant`,
 * normalized to Orca form ("@COREONE HF0.6" -> "core one hf 0.6"), must contain
 * a filter token. One-directional so "CORE One HF 0.6" matches HF 0.6 but not HF 0.4.
 */
function matchesPrinter(name: string, normalizedFilter: string[]): boolean {
  const at = name.indexOf("@");
  if (at === -1) return true;
  const canonical = prusaToOrcaName(name) ?? name;
  const cAt = canonical.indexOf("@");
  const variant = normalizeForMatch(cAt === -1 ? canonical : canonical.slice(cAt + 1));
  return normalizedFilter.some((f) => variant.includes(f));
}

function nodeToProfile(node: VendorNode, graph: VendorGraph): PrusaProfile {
  return {
    kind: "filament",
    name: node.name,
    inherits: node.parents.length ? node.parents.join("; ") : undefined,
    settings: node.settings,
    source: graph.source,
  };
}

// Ingests a PrusaSlicer *vendor* bundle (e.g. PrusaResearch.ini) into an
// inheritance graph of every filament profile it defines — including the
// abstract `*base*` profiles and the concrete, user-facing ones.
//
// This is the missing half of a real migration: a user's export only stores the
// DIFF over a system parent, and the system parents live here, not in the export.
// With this graph the converter can either re-link to an Orca preset or flatten
// the full parent chain into a standalone profile.

import type { VendorGraph, VendorNode, SourceInfo } from "../types.js";
import { parseIni, detectSource } from "./parseIni.js";

const FILAMENT_PREFIX = "filament:";

/** Build the filament inheritance graph from raw vendor-bundle .ini text. */
export function buildVendorGraph(text: string, file?: string): VendorGraph {
  const parsed = parseIni(text);
  const source: SourceInfo = detectSource(parsed.header, file);
  const nodes = new Map<string, VendorNode>();

  if (parsed.sections) {
    for (const [header, settings] of parsed.sections) {
      if (!header.startsWith(FILAMENT_PREFIX)) continue;
      const name = header.slice(FILAMENT_PREFIX.length).trim();
      nodes.set(name, toNode(name, settings));
    }
  }
  return { nodes, source };
}

function toNode(name: string, raw: Record<string, string>): VendorNode {
  const { inherits, ...settings } = raw;
  return {
    name,
    abstract: isAbstract(name),
    parents: parseInherits(inherits),
    settings,
  };
}

/** Abstract bases are named `*something*` and are never selectable by a user. */
export function isAbstract(name: string): boolean {
  return name.startsWith("*") && name.endsWith("*");
}

/** `inherits = A; B; *base*` -> ["A", "B", "*base*"] (declared order preserved). */
export function parseInherits(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .replace(/^"+|"+$/g, "")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

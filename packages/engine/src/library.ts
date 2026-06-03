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
import { flatten } from "./transform/resolveGraph.js";

export interface LibraryOptions {
  /**
   * Keep only profiles whose `@variant` matches one of these tokens
   * (normalized substring), plus variant-less profiles. e.g. ["CORE One HF 0.6"].
   * Legacy name-based filter; prefer `printerModel`.
   */
  printerFilter?: string[];
  /**
   * Keep only profiles compatible with this printer_model token (e.g. "COREONEL"),
   * decided from each profile's compatible_printers_condition. Universal profiles
   * (no condition) always pass. Pass `index` to avoid rebuilding it each call.
   */
  printerModel?: string;
  index?: CompatibilityIndex;
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

export interface PrinterOption {
  /** Friendly name, e.g. "CORE One L" (from the bundle's printer_model section). */
  label: string;
  /** printer_model token used inside compatibility rules, e.g. "COREONEL". */
  model: string;
  /** How many concrete profiles explicitly list this printer model. */
  count: number;
}

export interface ModelConstraint {
  /** printer_model tokens the condition explicitly allows (positive matches). */
  allow: Set<string>;
  /** printer_model tokens the condition explicitly excludes (negatives). */
  deny: Set<string>;
}

export interface CompatibilityIndex {
  /** The real printer list, derived from compatible_printers_condition rules. */
  printers: PrinterOption[];
  /** profileName -> its resolved printer_model allow/deny constraint. */
  byProfile: Map<string, ModelConstraint>;
  /** Profiles with no condition at all — usable on every printer. */
  universal: Set<string>;
}

/** Pull positive printer_model tokens out of a compatible_printers_condition. */
export function extractPrinterModels(condition: string): string[] {
  const out: string[] = [];
  // printer_model=~/(A|B|C)/  or  printer_model=~/.*XL.*/   (ignores !~ negatives)
  for (const m of condition.matchAll(/printer_model\s*=~\s*\/\(?([^/)]*)\)?\//g)) {
    for (const t of m[1]!.split("|")) {
      const tok = cleanModelToken(t);
      if (tok) out.push(tok);
    }
  }
  // printer_model=="X"  (ignores != negatives)
  for (const m of condition.matchAll(/printer_model\s*==\s*"?([A-Za-z0-9._]+)"?/g)) {
    const tok = cleanModelToken(m[1]!);
    if (tok) out.push(tok);
  }
  return out;
}

/** Pull NEGATIVE printer_model tokens (printer_model!~/.../ and printer_model!="X"). */
function extractPrinterModelDenies(condition: string): string[] {
  const out: string[] = [];
  for (const m of condition.matchAll(/printer_model\s*!~\s*\/\(?([^/)]*)\)?\//g)) {
    for (const t of m[1]!.split("|")) {
      const tok = cleanModelToken(t);
      if (tok) out.push(tok);
    }
  }
  for (const m of condition.matchAll(/printer_model\s*!=\s*"?([A-Za-z0-9._]+)"?/g)) {
    const tok = cleanModelToken(m[1]!);
    if (tok) out.push(tok);
  }
  return out;
}

/** Strip regex wildcards/anchors so `.*XL.*` -> `XL` (but keep literal dots like MK3.9). */
function cleanModelToken(raw: string): string {
  return raw
    .replace(/\.\*|\.\+|\.\?/g, "")
    .replace(/[\^$()?+\\]/g, "")
    .trim();
}

/**
 * Index every concrete profile by the printer models it's compatible with — by
 * resolving each profile's compatible_printers_condition through its inheritance
 * chain. Backs a "pick your actual printer" list (CORE One L, MK4S, …) and a
 * compatibility-correct filter, instead of guessing from the profile name.
 */
export function buildCompatibilityIndex(graph: VendorGraph): CompatibilityIndex {
  const byProfile = new Map<string, ModelConstraint>();
  const universal = new Set<string>();
  const counts = new Map<string, number>();

  for (const node of graph.nodes.values()) {
    if (node.abstract) continue;
    const cond = flatten(graph, node.parents, node.settings).settings[
      "compatible_printers_condition"
    ];
    if (!cond || !cond.trim()) {
      universal.add(node.name);
      continue;
    }
    const allow = new Set(extractPrinterModels(cond));
    const deny = new Set(extractPrinterModelDenies(cond));
    byProfile.set(node.name, { allow, deny });
    for (const m of allow) counts.set(m, (counts.get(m) ?? 0) + 1);
  }

  const printers = [...counts.entries()]
    .map(([model, count]) => ({ model, label: friendlyPrinterName(graph, model), count }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return { printers, byProfile, universal };
}

function friendlyPrinterName(graph: VendorGraph, model: string): string {
  const name = graph.printerModels.get(model);
  if (!name) return model;
  // "Prusa CORE One && CORE One+" -> "CORE One / CORE One+"; "Original Prusa MK4S" -> "MK4S".
  return name.replace(/\s*&&\s*/g, " / ").replace(/^(Original\s+)?Prusa\s+/i, "");
}

export interface LibraryProfileInfo {
  name: string;
  /** True when OrcaSlicer already ships this exact profile (no need to convert). */
  alreadyInOrca: boolean;
  orcaMatch?: string;
}

/**
 * Cheap listing of the concrete profiles a printer filter selects — WITHOUT
 * converting them. Backs a "pick which system profiles to add" checklist, so we
 * only do the (cheap, but non-zero) conversion work for the ones a user ticks.
 */
export function listConvertibleProfiles(
  graph: VendorGraph,
  orca: OrcaNameIndex,
  opts: LibraryOptions = {},
): LibraryProfileInfo[] {
  const filter = opts.printerFilter?.map(normalizeForMatch);
  const model = opts.printerModel;
  const index = model ? (opts.index ?? buildCompatibilityIndex(graph)) : undefined;
  const out: LibraryProfileInfo[] = [];
  for (const node of graph.nodes.values()) {
    if (node.abstract) continue;
    if (filter && !matchesPrinter(node.name, filter)) continue;
    if (model && index && !compatibleWith(index, node.name, model)) continue;
    const match = matchOrcaProfile(node.name, orca);
    out.push({ name: node.name, alreadyInOrca: !!match, orcaMatch: match ?? undefined });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Is a profile compatible with `model`?
 *   - no condition (universal) -> yes
 *   - model explicitly denied -> no
 *   - has positive models -> only if listed
 *   - deny-only (e.g. !="MK3.5") -> yes for everything not denied
 *   - condition with no printer_model info (printer_notes-only) -> no (can't
 *     attribute to a specific printer; excluded to avoid cross-printer leakage)
 */
function compatibleWith(index: CompatibilityIndex, name: string, model: string): boolean {
  if (index.universal.has(name)) return true;
  const c = index.byProfile.get(name);
  if (!c) return false;
  if (c.deny.has(model)) return false;
  if (c.allow.size > 0) return c.allow.has(model);
  return c.deny.size > 0;
}

/** Convert a specific set of vendor profiles by name (the ones a user selected). */
export function convertSelectedVendorProfiles(
  graph: VendorGraph,
  orca: OrcaNameIndex,
  names: Iterable<string>,
): ConversionResult[] {
  const ctx: ResolutionContext = { orca, vendor: graph };
  const out: ConversionResult[] = [];
  for (const name of names) {
    const node = graph.nodes.get(name);
    if (node) out.push(convertFilamentProfile(nodeToProfile(node, graph), ctx));
  }
  return out;
}

export interface PrinterVariant {
  /** Normalized display label, e.g. "CORE One HF 0.6". Also the filter token. */
  label: string;
  /** How many concrete (user-facing) profiles target this printer/nozzle. */
  count: number;
}

/**
 * Distinct printer/nozzle variants present in a vendor bundle — the data behind
 * a "pick your printer" dropdown. Extracts the `@variant` from every concrete
 * profile, normalized to Orca form, with a count. Variant-less (universal)
 * profiles are excluded (they apply to every printer).
 */
export function listPrinterVariants(graph: VendorGraph): PrinterVariant[] {
  const counts = new Map<string, number>();
  for (const node of graph.nodes.values()) {
    if (node.abstract) continue;
    const at = node.name.indexOf("@");
    if (at === -1) continue;
    const canonical = prusaToOrcaName(node.name) ?? node.name;
    const cAt = canonical.indexOf("@");
    const label = (cAt === -1 ? "" : canonical.slice(cAt + 1)).trim();
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
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

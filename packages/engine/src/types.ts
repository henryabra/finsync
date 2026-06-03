// Canonical intermediate representation (IR) shared by every module.

export type ProfileKind = "print" | "filament" | "printer";

/** A single PrusaSlicer/SuperSlicer profile parsed from an .ini source. */
export interface PrusaProfile {
  kind: ProfileKind;
  /** Profile name (from a bundle section header, or *_settings_id in a flat config). */
  name: string;
  /** Raw parent preset name (PrusaSlicer side), if the profile inherits. */
  inherits?: string;
  /** Raw key -> value, exactly as stored in the .ini (all values are strings). */
  settings: Record<string, string>;
  source: SourceInfo;
}

export interface SourceInfo {
  slicer: string; // e.g. "PrusaSlicer"
  version?: string; // e.g. "2.9.5"
  file?: string;
}

/** An OrcaSlicer profile object, ready to be JSON-serialized. */
export interface OrcaProfile {
  type: "filament";
  name: string;
  from: "User";
  instantiation: "true";
  inherits?: string;
  /** Every setting value in Orca filament JSON is a single-element string array. */
  [key: string]: string | string[] | undefined;
}

export type ReportSeverity = "info" | "warn" | "error";

export interface ReportEntry {
  severity: ReportSeverity;
  /** Source (Prusa) key this entry concerns, when applicable. */
  sourceKey?: string;
  /** Target (Orca) key(s) produced, when applicable. */
  targetKey?: string | string[];
  message: string;
}

export type InheritsStatus =
  | { kind: "none" }
  | { kind: "resolved"; orca: string; prusa: string } // re-linked to an Orca preset
  | { kind: "flattened"; from: string[]; missing: string[] } // parent values inlined
  | { kind: "carried"; raw: string }; // carried verbatim, user must verify

/** How the profile's inheritance was handled when producing the Orca output. */
export type ConversionStrategy =
  | "relink" // emitted a diff that inherits an existing Orca preset
  | "flatten" // resolved the parent chain and inlined every value (standalone)
  | "diff-only"; // no resolution context: emitted the diff as-is (legacy behavior)

export interface ConversionResult {
  profile: OrcaProfile;
  /** Suggested Orca filename (without directory). */
  filename: string;
  report: ReportEntry[];
  inherits: InheritsStatus;
  strategy: ConversionStrategy;
  stats: {
    mapped: number; // source keys that produced >=1 target key
    droppedNoMapping: number; // source keys with no known Orca equivalent
    nilSkipped: number; // source keys whose value was `nil`
    droppedInvalid: number; // target keys rejected by the Orca schema validator
  };
}

/**
 * Optional knowledge fed to the converter so it can complete profiles whose
 * system parents weren't in the export:
 *   - `orca`: names of presets OrcaSlicer already ships (for re-linking).
 *   - `vendor`: the full PrusaSlicer vendor graph (for flattening when Orca lacks it).
 */
export interface ResolutionContext {
  orca?: OrcaNameIndex;
  vendor?: VendorGraph;
}

/** A single node in a PrusaSlicer vendor profile inheritance graph. */
export interface VendorNode {
  name: string;
  /** Abstract bases have names wrapped in asterisks (e.g. `*PLA*`); not user-facing. */
  abstract: boolean;
  /** Parents from `inherits` (a `;`-separated list), in declared order. */
  parents: string[];
  /** This node's own settings, excluding the `inherits` key. */
  settings: Record<string, string>;
}

export interface VendorGraph {
  nodes: Map<string, VendorNode>;
  /** printer_model token (e.g. "COREONEL") -> friendly name (e.g. "Prusa CORE One L"). */
  printerModels: Map<string, string>;
  source: SourceInfo;
}

/** Lookup of OrcaSlicer preset names, normalized for matching. */
export interface OrcaNameIndex {
  /** Canonical (display) names, as Orca ships them. */
  names: readonly string[];
  /** normalized-key -> canonical name, for case/spacing-insensitive matching. */
  byNormalized: Map<string, string>;
}

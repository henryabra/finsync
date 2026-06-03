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
  | { kind: "resolved"; orca: string; prusa: string }
  | { kind: "carried"; raw: string }; // carried verbatim, user must verify

export interface ConversionResult {
  profile: OrcaProfile;
  /** Suggested Orca filename (without directory). */
  filename: string;
  report: ReportEntry[];
  inherits: InheritsStatus;
  stats: {
    mapped: number; // source keys that produced >=1 target key
    droppedNoMapping: number; // source keys with no known Orca equivalent
    nilSkipped: number; // source keys whose value was `nil`
    droppedInvalid: number; // target keys rejected by the Orca schema validator
  };
}

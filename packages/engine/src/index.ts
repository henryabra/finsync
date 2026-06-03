// Public API of @finsync/engine.
// Pure, dependency-free, and isomorphic — runs identically in Node and the browser.

export type {
  PrusaProfile,
  OrcaProfile,
  ConversionResult,
  ReportEntry,
  ReportSeverity,
  InheritsStatus,
  ProfileKind,
} from "./types.js";

export { parseIni, detectSource } from "./ingest/parseIni.js";
export { extractFilamentProfiles } from "./ingest/extractProfiles.js";
export { convertFilamentProfile } from "./convertFilament.js";
export { formatReport } from "./report/report.js";
export { schemaSource, ORCA_FILAMENT_KEYS } from "./schema/orcaFilament.js";

import { extractFilamentProfiles } from "./ingest/extractProfiles.js";
import { convertFilamentProfile } from "./convertFilament.js";
import type { ConversionResult } from "./types.js";

/** Convenience: raw .ini text -> one ConversionResult per filament profile found. */
export function convertIniToOrcaFilaments(
  text: string,
  file?: string,
): ConversionResult[] {
  return extractFilamentProfiles(text, file).map(convertFilamentProfile);
}

// Public API of @finsync/engine.
// Pure, dependency-free, and isomorphic — runs identically in Node and the browser.

export type {
  PrusaProfile,
  OrcaProfile,
  ConversionResult,
  ConversionStrategy,
  ReportEntry,
  ReportSeverity,
  InheritsStatus,
  ProfileKind,
  ResolutionContext,
  VendorGraph,
  VendorNode,
  OrcaNameIndex,
} from "./types.js";

export { parseIni, detectSource } from "./ingest/parseIni.js";
export { extractFilamentProfiles } from "./ingest/extractProfiles.js";
export { buildVendorGraph, isAbstract } from "./ingest/vendorBundle.js";
export {
  fetchPrusaVendorBundle,
  prusaBundleUrl,
  PRUSA_VENDOR_REFS,
  DEFAULT_PRUSA_REF,
} from "./ingest/fetchVendorBundle.js";
export type { PrusaVendorRef, FetchedVendorBundle } from "./ingest/fetchVendorBundle.js";
export { convertFilamentProfile } from "./convertFilament.js";
export { convertVendorLibrary } from "./library.js";
export type { LibraryOptions, LibraryEntry, LibrarySkipReason } from "./library.js";
export { matchOrcaProfile, prusaToOrcaName } from "./transform/orcaMatch.js";
export { formatReport } from "./report/report.js";
export { schemaSource, ORCA_FILAMENT_KEYS } from "./schema/orcaFilament.js";
export {
  ORCA_FILAMENT_PROFILE_INDEX,
  ORCA_FILAMENT_PROFILE_NAMES,
  orcaProfileSource,
} from "./schema/orcaProfiles.js";

import { extractFilamentProfiles } from "./ingest/extractProfiles.js";
import { convertFilamentProfile } from "./convertFilament.js";
import { buildVendorGraph } from "./ingest/vendorBundle.js";
import { ORCA_FILAMENT_PROFILE_INDEX } from "./schema/orcaProfiles.js";
import type { ConversionResult, ResolutionContext } from "./types.js";

/**
 * Build a resolution context. Re-linking to Orca's shipped presets is always on;
 * pass a vendor bundle (PrusaResearch.ini text) to enable flattening for parents
 * Orca doesn't ship.
 */
export function createContext(opts: { vendorText?: string; vendorFile?: string } = {}): ResolutionContext {
  return {
    orca: ORCA_FILAMENT_PROFILE_INDEX,
    vendor: opts.vendorText ? buildVendorGraph(opts.vendorText, opts.vendorFile) : undefined,
  };
}

/**
 * Convenience: raw .ini text -> one ConversionResult per filament profile found.
 * Re-links to Orca presets by default; pass a context (see `createContext`) with
 * a vendor bundle to flatten profiles Orca doesn't ship.
 */
export function convertIniToOrcaFilaments(
  text: string,
  file?: string,
  ctx: ResolutionContext = { orca: ORCA_FILAMENT_PROFILE_INDEX },
): ConversionResult[] {
  return extractFilamentProfiles(text, file).map((p) => convertFilamentProfile(p, ctx));
}

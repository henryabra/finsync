// Module 1b: turn a ParsedIni into one or more filament PrusaProfiles (IR).

import type { PrusaProfile } from "../types.js";
import { FILAMENT_SOURCE_KEYS } from "../mapping/filament.js";
import { parseIni, detectSource, type ParsedIni } from "./parseIni.js";

/** Extract every filament profile from raw .ini text. */
export function extractFilamentProfiles(
  text: string,
  file?: string,
): PrusaProfile[] {
  const parsed = parseIni(text);
  const source = detectSource(parsed.header, file);
  if (parsed.sections) return fromBundle(parsed, source);
  if (parsed.flat) {
    const p = fromFlatConfig(parsed.flat, source);
    return p ? [p] : [];
  }
  return [];
}

function fromBundle(
  parsed: ParsedIni,
  source: PrusaProfile["source"],
): PrusaProfile[] {
  const out: PrusaProfile[] = [];
  for (const [header, settings] of parsed.sections!) {
    if (!header.startsWith("filament:")) continue;
    const name = header.slice("filament:".length).trim();
    const { inherits, settings: cleaned } = splitInherits(settings);
    out.push({ kind: "filament", name, inherits, settings: cleaned, source });
  }
  return out;
}

/**
 * A flat "Export Config" mixes print + filament + printer keys. Pull out the
 * filament-domain keys and name the profile from filament_settings_id.
 */
function fromFlatConfig(
  flat: Record<string, string>,
  source: PrusaProfile["source"],
): PrusaProfile | null {
  const settings: Record<string, string> = {};
  for (const [k, v] of Object.entries(flat)) {
    if (FILAMENT_SOURCE_KEYS.has(k)) settings[k] = v;
  }
  if (Object.keys(settings).length === 0) return null;
  const name =
    cleanName(flat["filament_settings_id"]) ||
    cleanName(flat["filament_type"]) ||
    "Imported filament";
  const { inherits, settings: cleaned } = splitInherits(settings);
  // a flat config may also carry `inherits` at top level
  const topInherits = flat["inherits"];
  return {
    kind: "filament",
    name,
    inherits: inherits ?? (topInherits ? cleanName(topInherits) : undefined),
    settings: cleaned,
    source,
  };
}

function splitInherits(settings: Record<string, string>): {
  inherits?: string;
  settings: Record<string, string>;
} {
  const { inherits, ...rest } = settings;
  return { inherits: inherits ? cleanName(inherits) : undefined, settings: rest };
}

function cleanName(v: string | undefined): string {
  if (!v) return "";
  return v.replace(/^"+|"+$/g, "").trim();
}

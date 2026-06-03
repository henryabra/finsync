// Module 7: assemble the final Orca filament JSON object.
// Every setting value in Orca filament profiles is a single-element string array.

import type { OrcaProfile, InheritsStatus } from "../types.js";

/**
 * Orca's filament-config schema version. Matches what OrcaSlicer 2.3.x writes
 * into every user filament `.json` (`"version"`). Required — Orca uses it to
 * decide how to read the preset.
 */
export const ORCA_FILAMENT_VERSION = "2.3.2.60";

export function emitFilament(
  name: string,
  values: Record<string, string>,
  inherits: InheritsStatus,
): OrcaProfile {
  // A re-linked profile points at its Orca parent; everything else (flattened or
  // contextless) is a standalone, which Orca represents with an empty `inherits`.
  const inheritsName =
    inherits.kind === "resolved"
      ? inherits.orca
      : inherits.kind === "carried"
        ? inherits.raw
        : "";

  // Exactly the metadata shape OrcaSlicer writes for a UI-created user filament:
  // no `type`, no `instantiation`, `inherits` always present.
  const profile: OrcaProfile = {
    name,
    from: "User",
    inherits: inheritsName,
    version: ORCA_FILAMENT_VERSION,
    filament_settings_id: [name],
  };

  // The `compatible_*` set belongs ONLY on a standalone (flattened) profile, which
  // carries its own compatibility — the export step stamps the user's printer onto
  // `compatible_printers`. A re-linked diff must OMIT these so it inherits its
  // parent's compatibility; an empty `compatible_printers` would instead read as
  // "no printers" and file the profile under Orca's "Unsupported presets".
  if (inheritsName === "") {
    profile.compatible_printers = [];
    profile.compatible_printers_condition = "";
    profile.compatible_prints = [];
    profile.compatible_prints_condition = "";
  }

  // `compatible_printers`/`compatible_prints` are real multi-value arrays in Orca
  // (split on ';' or ','); every other setting is a single-element string array.
  for (const [key, value] of Object.entries(values)) {
    if (key === "compatible_printers" || key === "compatible_prints") {
      profile[key] = splitList(value);
    } else if (key === "compatible_printers_condition" || key === "compatible_prints_condition") {
      profile[key] = value; // bare string, not array-wrapped
    } else {
      profile[key] = [value];
    }
  }
  return profile;
}

function splitList(value: string): string[] {
  if (value.trim() === "") return [];
  return value
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function suggestFilename(name: string): string {
  const safe = name.replace(/[\\/:*?"<>|]/g, "_").trim();
  return `${safe}.json`;
}

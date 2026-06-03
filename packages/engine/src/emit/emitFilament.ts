// Module 7: assemble the final Orca filament JSON object.
// Every setting value in Orca filament profiles is a single-element string array.

import type { OrcaProfile, InheritsStatus } from "../types.js";

export function emitFilament(
  name: string,
  values: Record<string, string>,
  inherits: InheritsStatus,
): OrcaProfile {
  const profile: OrcaProfile = {
    type: "filament",
    name,
    from: "User",
    instantiation: "true",
  };

  if (inherits.kind === "resolved") profile.inherits = inherits.orca;
  else if (inherits.kind === "carried") profile.inherits = inherits.raw;

  // `compatible_printers` is a real multi-value array in Orca; split on ';' or ','.
  for (const [key, value] of Object.entries(values)) {
    if (key === "compatible_printers" || key === "compatible_prints") {
      profile[key] = splitList(value);
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

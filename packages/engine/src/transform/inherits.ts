// Inheritance resolver.
//
// A custom Prusa filament profile usually stores only the DIFF from a system
// parent (e.g. `inherits = Generic ABS @COREONE HF0.6`). The parent's values
// are NOT in the export, so a converted profile is only valid in Orca if it
// re-links to the equivalent Orca system preset.
//
// Orca's Prusa-vendor presets follow the pattern:
//   "Prusa <Material> @<MODEL with spaces> <variant>"
// We attempt a best-effort normalization and, when unsure, carry the raw value
// and flag it LOUDLY in the report (this is the one place silent migration
// would produce a broken profile).

import type { InheritsStatus } from "../types.js";

/** Known exact Prusa->Orca system preset renames can be added here over time. */
const KNOWN: Record<string, string> = {};

export function resolveInherits(raw: string | undefined): InheritsStatus {
  if (!raw) return { kind: "none" };
  const key = raw.trim();
  if (KNOWN[key]) return { kind: "resolved", orca: KNOWN[key]!, prusa: key };

  const guess = normalizePrusaPreset(key);
  if (guess) return { kind: "resolved", orca: guess, prusa: key };
  return { kind: "carried", raw: key };
}

/**
 * Heuristic: "Generic ABS @COREONE HF0.6" -> "Prusa Generic ABS @CORE One HF 0.6".
 * Returns undefined when we are not confident enough to claim a resolution.
 */
function normalizePrusaPreset(name: string): string | undefined {
  const at = name.indexOf("@");
  if (at === -1) return undefined;
  const left = name.slice(0, at).trim();
  let right = name.slice(at + 1).trim();

  // COREONE / COREONEL -> "CORE One" / "CORE One L"
  right = right
    .replace(/COREONE\s*L\b/gi, "CORE One L")
    .replace(/COREONE\b/gi, "CORE One")
    .replace(/HF\s*0\.(\d)/gi, "HF 0.$1") // HF0.6 -> HF 0.6
    .replace(/\s+/g, " ")
    .trim();

  const candidate = `Prusa ${left} @${right}`;
  // Only claim resolution when the model token looks recognized.
  return /CORE One|MK4|MK3|MINI|XL/i.test(right) ? candidate : undefined;
}

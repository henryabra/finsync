// Orchestrator: PrusaProfile -> ConversionResult, wiring modules 5-8 together.

import type { PrusaProfile, ConversionResult } from "./types.js";
import { transformFilament } from "./transform/filament.js";
import { resolveInherits } from "./transform/inherits.js";
import { validateFilamentValues } from "./validate/validate.js";
import { emitFilament, suggestFilename } from "./emit/emitFilament.js";

export function convertFilamentProfile(profile: PrusaProfile): ConversionResult {
  const t = transformFilament(profile);
  const v = validateFilamentValues(t.values);
  const inherits = resolveInherits(profile.inherits);
  const orca = emitFilament(profile.name, v.kept, inherits);

  return {
    profile: orca,
    filename: suggestFilename(profile.name),
    report: [...t.report, ...v.report],
    inherits,
    stats: {
      mapped: t.stats.mapped,
      droppedNoMapping: t.stats.droppedNoMapping,
      nilSkipped: t.stats.nilSkipped,
      droppedInvalid: v.droppedInvalid,
    },
  };
}

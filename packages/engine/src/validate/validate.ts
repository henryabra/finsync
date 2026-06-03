// Module 6: validate produced Orca keys against the live target schema.
// Unknown keys are dropped (not silently — every drop is reported), so output
// only ever contains keys current OrcaSlicer actually understands.

import type { ReportEntry } from "../types.js";
import { ORCA_FILAMENT_KEYS } from "../schema/orcaFilament.js";

export interface ValidationResult {
  kept: Record<string, string>;
  report: ReportEntry[];
  droppedInvalid: number;
}

export function validateFilamentValues(
  values: Record<string, string>,
): ValidationResult {
  const kept: Record<string, string> = {};
  const report: ReportEntry[] = [];
  let droppedInvalid = 0;

  for (const [key, value] of Object.entries(values)) {
    if (ORCA_FILAMENT_KEYS.has(key)) {
      kept[key] = value;
    } else {
      droppedInvalid++;
      report.push({
        severity: "warn",
        targetKey: key,
        message: `"${key}" is not in the current Orca filament schema — dropped to keep the profile loadable.`,
      });
    }
  }
  return { kept, report, droppedInvalid };
}

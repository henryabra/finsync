// Module 5: transform a filament PrusaProfile's raw settings into Orca
// (targetKey -> value) pairs, applying the proven value-level special cases.

import type { PrusaProfile, ReportEntry } from "../types.js";
import {
  FILAMENT_KEY_MAP,
  GCODE_KEYS,
  FILAMENT_TYPE_ALIASES,
  DEFAULT_MAX_VOLUMETRIC_SPEED,
} from "../mapping/filament.js";
import { unbackslash } from "./gcode.js";
import { ORCA_FILAMENT_KEYS, STRUCTURAL_KEYS } from "../schema/orcaFilament.js";

// Compatibility RULES whose value is a Prusa-specific expression. OrcaSlicer
// evaluates these against installed printers and rejects the import when they
// reference printer models it doesn't have — so we drop them outright.
const DROP_KEYS = new Set(["compatible_printers_condition", "compatible_prints_condition"]);

export interface TransformOutput {
  /** Orca key -> scalar string value (emitter wraps these in arrays). */
  values: Record<string, string>;
  report: ReportEntry[];
  stats: { mapped: number; droppedNoMapping: number; nilSkipped: number };
}

export function transformFilament(profile: PrusaProfile): TransformOutput {
  const values: Record<string, string> = {};
  const report: ReportEntry[] = [];
  let mapped = 0;
  let droppedNoMapping = 0;
  let nilSkipped = 0;

  const filamentType = profile.settings["filament_type"] ?? "";

  for (const [srcKey, rawValue] of Object.entries(profile.settings)) {
    // `nil` means "inherit from printer/parent" — omit so Orca falls back.
    if (rawValue === "nil") {
      nilSkipped++;
      continue;
    }

    // PrusaSlicer's printer-compatibility RULES reference Prusa's own
    // printer_model tokens (MK4, MK3.9, …) which OrcaSlicer can't match — so
    // carrying them over makes Orca's importer reject the profile as
    // "incompatible". Drop them; an empty compatible_printers means the profile
    // is usable on every printer, and the user selects it for theirs in Orca.
    if (DROP_KEYS.has(srcKey)) {
      droppedNoMapping++;
      report.push({
        severity: "warn",
        sourceKey: srcKey,
        message: `Dropped "${srcKey}" — it names Prusa printer models OrcaSlicer can't match (the reason Orca refuses such imports). The profile stays compatible with every printer; just select it for yours in Orca.`,
      });
      continue;
    }

    let target = FILAMENT_KEY_MAP[srcKey];

    // Identity passthrough: an unmapped Prusa key whose name is itself a valid
    // Orca filament key (per the live schema) maps 1:1. Both slicers share a
    // Slic3r ancestry, so many keys are simply identical (filament_cooling_*,
    // ramming, load/unload times, …). The schema guard prevents false positives.
    if (!target && !STRUCTURAL_KEYS.has(srcKey) && ORCA_FILAMENT_KEYS.has(srcKey)) {
      values[srcKey] = transformValue(srcKey, rawValue, filamentType).value;
      mapped++;
      report.push({
        severity: "info",
        sourceKey: srcKey,
        targetKey: srcKey,
        message: `"${srcKey}" passed through 1:1 (identical key in current Orca schema).`,
      });
      continue;
    }

    if (!target) {
      droppedNoMapping++;
      report.push({
        severity: "info",
        sourceKey: srcKey,
        message: `No Orca filament equivalent for "${srcKey}" — dropped.`,
      });
      continue;
    }

    const { value, note } = transformValue(srcKey, rawValue, filamentType);
    const targets = Array.isArray(target) ? target : [target];
    for (const t of targets) values[t] = value;
    mapped++;

    if (Array.isArray(target)) {
      report.push({
        severity: "info",
        sourceKey: srcKey,
        targetKey: target,
        message: `"${srcKey}" fanned out to ${target.length} Orca keys.`,
      });
    }
    if (note) {
      report.push({ severity: "warn", sourceKey: srcKey, targetKey: target, message: note });
    }
  }

  return { values, report, stats: { mapped, droppedNoMapping, nilSkipped } };
}

function transformValue(
  key: string,
  value: string,
  filamentType: string,
): { value: string; note?: string } {
  if (GCODE_KEYS.has(key)) return { value: unbackslash(value) };

  switch (key) {
    case "filament_type": {
      const mapped = FILAMENT_TYPE_ALIASES[value.toUpperCase()];
      return mapped
        ? { value: mapped, note: `filament_type "${value}" renamed to "${mapped}" for Orca.` }
        : { value };
    }
    case "filament_max_volumetric_speed": {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) return { value };
      const fallback = DEFAULT_MAX_VOLUMETRIC_SPEED[filamentType.toUpperCase()] ?? "8";
      return {
        value: fallback,
        note: `Orca forbids filament_max_volumetric_speed=0; substituted ${fallback} for ${filamentType || "unknown"}.`,
      };
    }
    case "external_perimeter_fan_speed": {
      // Orca's overhang_fan_threshold is a percentage; Prusa uses a raw speed.
      const n = Number(value);
      const pct = Number.isFinite(n) && n >= 0 ? `${n}%` : "0%";
      return { value: pct, note: `Mapped to Orca overhang_fan_threshold as "${pct}".` };
    }
    default:
      return { value };
  }
}

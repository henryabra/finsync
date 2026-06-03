// Module 3: the TARGET schema (Orca filament keys) — the "up-to-date" layer.
//
// This is the allowlist the validator checks emitted keys against. It is meant
// to be REGENERATED from the OrcaSlicer source by packages/schema-sync (which
// reads resources/profiles/**/filament JSON keys + the C++ config definitions),
// so it tracks new Orca releases instead of rotting on a hardcoded version.
//
// The set below was bootstrapped from OrcaSlicer's real Prusa system filament
// profiles. `schemaSource` records what it was generated against.

import { ORCA_FILAMENT_KEYS_GENERATED } from "./orcaFilament.generated.js";

export const schemaSource = {
  generatedFrom: "curated bootstrap UNION schema-sync (OrcaSlicer live repo)",
  orcaProfileVersion: "2.x",
};

/** Hand-curated core keys; guarantees the essentials even before a sync runs. */
const CURATED: ReadonlySet<string> = new Set([
  // identity / structural (handled by the emitter, allowed here too)
  "type",
  "name",
  "inherits",
  "from",
  "instantiation",
  "filament_id",
  "setting_id",
  "version",
  "compatible_printers",
  "compatible_printers_condition",
  "compatible_prints",
  "compatible_prints_condition",
  // temperatures
  "nozzle_temperature",
  "nozzle_temperature_initial_layer",
  "hot_plate_temp",
  "cool_plate_temp",
  "eng_plate_temp",
  "textured_plate_temp",
  "hot_plate_temp_initial_layer",
  "cool_plate_temp_initial_layer",
  "eng_plate_temp_initial_layer",
  "textured_plate_temp_initial_layer",
  "chamber_temperature",
  "idle_temperature",
  // material identity / physical
  "filament_type",
  "filament_vendor",
  "default_filament_colour",
  "filament_cost",
  "filament_density",
  "filament_diameter",
  "filament_soluble",
  "filament_max_volumetric_speed",
  "filament_flow_ratio",
  "filament_notes",
  // cooling / fans
  "reduce_fan_stop_start_freq",
  "fan_min_speed",
  "fan_max_speed",
  "overhang_fan_speed",
  "overhang_fan_threshold",
  "close_fan_the_first_x_layers",
  "full_fan_speed_layer",
  "fan_cooling_layer_time",
  "slow_down_layer_time",
  "slow_down_min_speed",
  // retraction (filament overrides)
  "filament_retraction_length",
  "filament_retraction_speed",
  "filament_deretraction_speed",
  "filament_retraction_minimum_travel",
  "filament_retract_before_wipe",
  "filament_retract_when_changing_layer",
  "filament_z_hop",
  "filament_retract_lift_above",
  "filament_retract_lift_below",
  "filament_retract_restart_extra",
  "filament_wipe",
  // custom g-code
  "filament_start_gcode",
  "filament_end_gcode",
  // wipe tower
  "filament_minimal_purge_on_wipe_tower",
]);

/**
 * The live target schema = curated core ∪ keys discovered from the OrcaSlicer
 * repo by schema-sync. The union keeps us correct on day one and current after
 * each sync, without ever losing a guaranteed key.
 */
export const ORCA_FILAMENT_KEYS: ReadonlySet<string> = new Set([
  ...CURATED,
  ...ORCA_FILAMENT_KEYS_GENERATED,
]);

/** Keys the emitter writes itself; not subject to the array-wrap value rule. */
export const STRUCTURAL_KEYS: ReadonlySet<string> = new Set([
  "type",
  "name",
  "inherits",
  "from",
  "instantiation",
  "filament_id",
  "setting_id",
  "version",
]);

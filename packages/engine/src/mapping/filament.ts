// Module 4: the PROVEN filament mapping, as data.
//
// Seeded from theophile/SuperSlicer_to_Orca_scripts (the de-facto reference
// converter) and verified against real OrcaSlicer system filament JSONs.
// Keep this a pure data table so non-programmers can contribute new keys.
//
// A target of `string`   -> rename 1:1
// A target of `string[]` -> one source key fans out to several Orca keys
//                           (e.g. bed_temperature -> the four plate-type temps)

export const FILAMENT_KEY_MAP: Record<string, string | string[]> = {
  // --- temperatures ---
  temperature: "nozzle_temperature",
  first_layer_temperature: "nozzle_temperature_initial_layer",
  bed_temperature: [
    "hot_plate_temp",
    "cool_plate_temp",
    "eng_plate_temp",
    "textured_plate_temp",
  ],
  first_layer_bed_temperature: [
    "hot_plate_temp_initial_layer",
    "cool_plate_temp_initial_layer",
    "eng_plate_temp_initial_layer",
    "textured_plate_temp_initial_layer",
  ],
  chamber_temperature: "chamber_temperature",
  idle_temperature: "idle_temperature",

  // --- material identity / physical ---
  filament_type: "filament_type",
  filament_vendor: "filament_vendor",
  filament_colour: "default_filament_colour",
  filament_cost: "filament_cost",
  filament_density: "filament_density",
  filament_diameter: "filament_diameter",
  filament_soluble: "filament_soluble",
  filament_max_volumetric_speed: "filament_max_volumetric_speed",
  extrusion_multiplier: "filament_flow_ratio",
  filament_notes: "filament_notes",

  // --- cooling / fans ---
  fan_always_on: "reduce_fan_stop_start_freq",
  min_fan_speed: "fan_min_speed",
  max_fan_speed: "fan_max_speed",
  bridge_fan_speed: "overhang_fan_speed",
  disable_fan_first_layers: "close_fan_the_first_x_layers",
  full_fan_speed_layer: "full_fan_speed_layer",
  fan_below_layer_time: "fan_cooling_layer_time",
  slowdown_below_layer_time: "slow_down_layer_time",
  min_print_speed: "slow_down_min_speed",
  external_perimeter_fan_speed: "overhang_fan_threshold",

  // --- retraction overrides (filament side) ---
  filament_retract_length: "filament_retraction_length",
  filament_retract_speed: "filament_retraction_speed",
  filament_deretract_speed: "filament_deretraction_speed",
  filament_retract_before_travel: "filament_retraction_minimum_travel",
  filament_retract_before_wipe: "filament_retract_before_wipe",
  filament_retract_layer_change: "filament_retract_when_changing_layer",
  filament_retract_lift: "filament_z_hop",
  filament_retract_lift_above: "filament_retract_lift_above",
  filament_retract_lift_below: "filament_retract_lift_below",
  filament_retract_restart_extra: "filament_retract_restart_extra",
  filament_wipe: "filament_wipe",

  // --- custom g-code ---
  start_filament_gcode: "filament_start_gcode",
  end_filament_gcode: "filament_end_gcode",

  // --- compatibility / wipe tower ---
  compatible_printers: "compatible_printers",
  compatible_printers_condition: "compatible_printers_condition",
  compatible_prints: "compatible_prints",
  compatible_prints_condition: "compatible_prints_condition",
  filament_minimal_purge_on_wipe_tower: "filament_minimal_purge_on_wipe_tower",
};

/** Source keys that identify the filament domain in a flat "Export Config". */
export const FILAMENT_SOURCE_KEYS: ReadonlySet<string> = new Set(
  Object.keys(FILAMENT_KEY_MAP),
);

/** Custom g-code values: unquote + un-escape "\n" before emitting. */
export const GCODE_KEYS: ReadonlySet<string> = new Set([
  "start_filament_gcode",
  "end_filament_gcode",
  "filament_notes",
]);

/** PrusaSlicer/SuperSlicer filament_type values that Orca names differently. */
export const FILAMENT_TYPE_ALIASES: Record<string, string> = {
  PET: "PETG",
  FLEX: "TPU",
  NYLON: "PA",
};

/**
 * Orca disallows filament_max_volumetric_speed = 0 (Prusa uses 0 = "unlimited").
 * Reasonable per-type defaults, mirroring the reference converter.
 */
export const DEFAULT_MAX_VOLUMETRIC_SPEED: Record<string, string> = {
  PLA: "15",
  PET: "10",
  PETG: "10",
  ABS: "12",
  ASA: "12",
  FLEX: "3.2",
  TPU: "3.2",
  NYLON: "12",
  PA: "12",
  PVA: "12",
  PC: "12",
  PSU: "8",
  HIPS: "8",
  PP: "8",
  PEI: "8",
  PEEK: "8",
  PEKK: "8",
  POM: "8",
};

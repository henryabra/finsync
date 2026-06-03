// The OrcaSlicer preset-name index used for re-linking. Generated names come
// from the live Orca repo (the "up-to-date" layer); the index normalizes them
// for case/space-insensitive matching.

import { ORCA_FILAMENT_PROFILE_NAMES } from "./orcaFilamentProfiles.generated.js";
import { buildOrcaNameIndex } from "../transform/orcaMatch.js";
import type { OrcaNameIndex } from "../types.js";

export { ORCA_FILAMENT_PROFILE_NAMES };

/** Ready-to-use index of every Orca Prusa-vendor filament preset name. */
export const ORCA_FILAMENT_PROFILE_INDEX: OrcaNameIndex = buildOrcaNameIndex(
  ORCA_FILAMENT_PROFILE_NAMES,
);

export const orcaProfileSource = {
  vendor: "Prusa",
  count: ORCA_FILAMENT_PROFILE_NAMES.length,
  generatedFrom: "OrcaSlicer live repo resources/profiles/Prusa/filament",
};

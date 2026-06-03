// Integration proof against the user's REAL PrusaResearch.ini vendor bundle.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  buildVendorGraph,
  convertVendorLibrary,
  ORCA_FILAMENT_PROFILE_INDEX,
  convertFilamentProfile,
  createContext,
} from "../src/index.js";

const PR = join(homedir(), "Library/Application Support/PrusaSlicer/vendor/PrusaResearch.ini");
const text = readFileSync(PR, "utf8");
const graph = buildVendorGraph(text, "PrusaResearch.ini");
console.log(`Vendor graph: ${graph.nodes.size} filament nodes`);

const filter = ["CORE One HF 0.6"];
const lib = convertVendorLibrary(graph, ORCA_FILAMENT_PROFILE_INDEX, { printerFilter: filter });

const by = (r: string) => lib.filter((e) => e.skipped === r).length;
const converted = lib.filter((e) => e.converted);
console.log(`\nLibrary run (filter = CORE One HF 0.6):`);
console.log(`  converted:         ${converted.length}`);
console.log(`  skipped (in Orca): ${by("already-in-orca")}`);
console.log(`  skipped (abstract):${by("abstract")}`);
console.log(`  skipped (filter):  ${by("printer-filter")}`);

const relink = converted.filter((e) => e.result!.strategy === "relink").length;
const flat = converted.filter((e) => e.result!.strategy === "flatten").length;
console.log(`  of converted -> relink: ${relink}, flatten: ${flat}`);

console.log(`\nSample converted Prusament profiles:`);
for (const e of converted.filter((e) => /Prusament/i.test(e.name)).slice(0, 6)) {
  const r = e.result!;
  console.log(
    `  • ${e.name}\n      strategy=${r.strategy} mapped=${r.stats.mapped} invalid=${r.stats.droppedInvalid} inherits=${JSON.stringify(r.inherits)}`,
  );
}

// Multi-parent flatten correctness: Prusament PLA @MK4S inherits "@PGIS; *PLAPG4S*".
const mk4s = graph.nodes.get("Prusament PLA @MK4S");
if (mk4s) {
  const ctx = createContext({ vendorText: text, vendorFile: "PrusaResearch.ini" });
  const r = convertFilamentProfile(
    { kind: "filament", name: mk4s.name, inherits: mk4s.parents.join("; "), settings: mk4s.settings, source: graph.source },
    { ...ctx, orca: undefined }, // force flatten to prove chain resolution
  );
  console.log(`\nFlatten proof — Prusament PLA @MK4S:`);
  console.log(`  strategy=${r.strategy}`);
  console.log(`  inherits=${JSON.stringify(r.inherits)}`);
  console.log(`  mapped=${r.stats.mapped}, has standalone temp=${JSON.stringify(r.profile.nozzle_temperature)}`);
  console.log(`  has bed temps (from *PLA*): hot_plate=${JSON.stringify(r.profile.hot_plate_temp)}`);
  console.log(`  fan from *PLAPG4S* (later parent wins): fan_min_speed=${JSON.stringify(r.profile.fan_min_speed)}`);
}

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildVendorGraph,
  convertFilamentProfile,
  convertVendorLibrary,
  convertIniToOrcaFilaments,
  createContext,
  listPrinterVariants,
  listConvertibleProfiles,
  convertSelectedVendorProfiles,
  buildCompatibilityIndex,
  extractPrinterModels,
  matchOrcaProfile,
  prusaToOrcaName,
  ORCA_FILAMENT_PROFILE_INDEX,
} from "../src/index.js";
import { flatten } from "../src/transform/resolveGraph.js";
import type { PrusaProfile } from "../src/types.js";

const FIX = join(__dirname, "fixtures");
const read = (f: string) => readFileSync(join(FIX, f), "utf8");
const graph = buildVendorGraph(read("vendor_mini.ini"), "vendor_mini.ini");

const node = (name: string): PrusaProfile => {
  const n = graph.nodes.get(name)!;
  return { kind: "filament", name, inherits: n.parents.join("; ") || undefined, settings: n.settings, source: graph.source };
};

describe("vendor graph", () => {
  it("loads every filament section, flags abstract bases", () => {
    expect(graph.nodes.get("*PLA*")!.abstract).toBe(true);
    expect(graph.nodes.get("Prusament PLA")!.abstract).toBe(false);
  });

  it("parses multi-parent inherits in declared order", () => {
    expect(graph.nodes.get("Prusament PLA @MK4S")!.parents).toEqual(["Prusament PLA", "*PLAFAST*"]);
  });
});

describe("flatten (PrusaSlicer merge semantics)", () => {
  const r = flatten(graph, ["Prusament PLA", "*PLAFAST*"], {});

  it("child chain overrides ancestors (Prusament PLA temp 215 beats *PLA* 210)", () => {
    expect(r.settings.temperature).toBe("215");
  });

  it("pulls inherited values down the chain (bed_temperature from *PLA*)", () => {
    expect(r.settings.bed_temperature).toBe("60");
  });

  it("a later parent wins over an earlier one (*PLAFAST* fan speeds)", () => {
    expect(r.settings.min_fan_speed).toBe("70");
  });

  it("records the merge chain nearest-last and reports nothing missing", () => {
    expect(r.chain).toEqual(["*common*", "*PLA*", "Prusament PLA", "*PLAFAST*"]);
    expect(r.missing).toEqual([]);
  });

  it("reports a parent that isn't in the bundle", () => {
    const o = flatten(graph, ["*MISSINGBASE*"], { filament_type: "PETG" });
    expect(o.missing).toEqual(["*MISSINGBASE*"]);
  });
});

describe("Prusa -> Orca name matching", () => {
  it("rewrites naming toward Orca's convention", () => {
    expect(prusaToOrcaName("Generic ABS @COREONE HF0.6")).toBe("Prusa Generic ABS @CORE One HF 0.6");
  });

  it("matches the real Orca preset index", () => {
    expect(matchOrcaProfile("Generic ABS @COREONE HF0.6", ORCA_FILAMENT_PROFILE_INDEX)).toBe(
      "Prusa Generic ABS @CORE One HF 0.6",
    );
  });

  it("never matches an abstract base", () => {
    expect(matchOrcaProfile("*PLA*", ORCA_FILAMENT_PROFILE_INDEX)).toBeNull();
    expect(prusaToOrcaName("*PLA*")).toBeNull();
  });
});

describe("re-link vs flatten strategy", () => {
  const ctx = createContext({ vendorText: read("vendor_mini.ini") }); // orca + vendor

  it("RE-LINKS when Orca ships the single parent (emits only the diff)", () => {
    // A user profile whose parent is a concrete preset Orca already ships.
    const userProfile: PrusaProfile = {
      kind: "filament",
      name: "My ABS",
      inherits: "Generic ABS @COREONE HF0.6",
      settings: { filament_type: "ABS", temperature: "260" },
      source: graph.source,
    };
    const r = convertFilamentProfile(userProfile, ctx);
    expect(r.strategy).toBe("relink");
    expect(r.inherits).toMatchObject({ kind: "resolved", orca: "Prusa Generic ABS @CORE One HF 0.6" });
    expect(r.profile.inherits).toBe("Prusa Generic ABS @CORE One HF 0.6");
  });

  it("FLATTENS a multi-parent profile into a standalone (empty inherits)", () => {
    const r = convertFilamentProfile(node("Prusament PLA @MK4S"), ctx);
    expect(r.strategy).toBe("flatten");
    // Standalone profiles use an empty `inherits` (matches a native Orca export),
    // not an absent one — and carry their own compatible_* set.
    expect(r.profile.inherits).toBe("");
    expect(r.profile.instantiation).toBeUndefined();
    expect(r.profile.compatible_printers).toEqual([]);
    expect(r.profile.compatible_printers_condition).toBe("");
    expect(r.profile.compatible_prints).toEqual([]);
    expect(r.profile.compatible_prints_condition).toBe("");
    expect(r.profile.version).toBe("2.3.2.60");
    expect(r.profile.filament_settings_id).toEqual(["Prusament PLA @MK4S"]);
    expect(r.profile.nozzle_temperature).toEqual(["215"]); // resolved from the chain
    expect(r.profile.fan_min_speed).toEqual(["70"]); // later-parent override survived
  });

  it("without a vendor bundle, an unshipped parent is carried and flagged", () => {
    const r = convertFilamentProfile(node("Orphan PETG"), { orca: ORCA_FILAMENT_PROFILE_INDEX });
    expect(r.strategy).toBe("diff-only");
    expect(r.inherits.kind).toBe("carried");
  });
});

describe("printer variants (for the picker)", () => {
  const variants = listPrinterVariants(graph);

  it("lists distinct @variants normalized to Orca form, with counts", () => {
    const v = variants.find((x) => x.label === "CORE One HF 0.6");
    expect(v).toBeDefined();
    expect(v!.count).toBe(1); // only Generic ABS @COREONE HF0.6 in the mini fixture
  });

  it("excludes abstract bases and variant-less profiles", () => {
    expect(variants.some((x) => x.label.includes("*"))).toBe(false);
    // "Prusament PLA" (no @variant) must not appear as a printer
    expect(variants.some((x) => x.label === "Prusament PLA")).toBe(false);
  });

  it("a picked variant filters the library to matching profiles", () => {
    const lib = convertVendorLibrary(graph, ORCA_FILAMENT_PROFILE_INDEX, {
      printerFilter: ["CORE One HF 0.6"],
    });
    // The MK4S profile should be filtered out for a CORE One HF 0.6 pick.
    expect(lib.find((e) => e.name === "Prusament PLA @MK4S")!.skipped).toBe("printer-filter");
  });
});

describe("library mode", () => {
  const lib = convertVendorLibrary(graph, ORCA_FILAMENT_PROFILE_INDEX);

  const entry = (name: string) => lib.find((e) => e.name === name)!;

  it("skips abstract bases", () => {
    expect(entry("*PLA*").skipped).toBe("abstract");
  });

  it("skips profiles Orca already ships", () => {
    const e = entry("Generic ABS @COREONE HF0.6");
    expect(e.skipped).toBe("already-in-orca");
    expect(e.orcaMatch).toBe("Prusa Generic ABS @CORE One HF 0.6");
  });

  it("converts a profile Orca lacks", () => {
    const e = entry("Prusament PLA @MK4S");
    expect(e.converted).toBe(true);
    expect(e.result!.stats.droppedInvalid).toBe(0);
  });

  it("honors a printer filter (variant-less profiles always pass)", () => {
    const filtered = convertVendorLibrary(graph, ORCA_FILAMENT_PROFILE_INDEX, { printerFilter: ["MK4S"] });
    const e = filtered.find((x) => x.name === "Prusament PLA @MK4S")!;
    expect(e.converted).toBe(true);
    // "Prusament PLA" has no @variant -> universal, still present
    expect(filtered.find((x) => x.name === "Prusament PLA")!.skipped).not.toBe("printer-filter");
  });
});

describe("condition-aware printer compatibility", () => {
  it("extracts positive printer_model tokens, ignoring negatives", () => {
    expect(
      extractPrinterModels("printer_model=~/(COREONE|COREONEL)/ and nozzle_diameter[0]==0.6"),
    ).toEqual(["COREONE", "COREONEL"]);
    expect(extractPrinterModels('printer_model!="MK3.5" and printer_notes=~/.*PG.*/')).toEqual([]);
  });

  const index = buildCompatibilityIndex(graph);

  it("lists real printers with friendly names from printer_model sections", () => {
    const l = index.printers.find((p) => p.model === "COREONEL");
    expect(l?.label).toBe("CORE One L");
    const co = index.printers.find((p) => p.model === "COREONE");
    expect(co?.label).toBe("CORE One / CORE One+"); // && cleaned up
    expect(index.printers.some((p) => p.model === "MK4S")).toBe(true);
  });

  it("treats a no-condition profile as universal", () => {
    expect(index.universal.has("Prusament PLA")).toBe(true);
  });

  it("filters profiles by actual printer compatibility, not name", () => {
    // @MK4S inherits *PLAFAST* (MK4S-only) -> not compatible with a CORE One L.
    const forL = listConvertibleProfiles(graph, ORCA_FILAMENT_PROFILE_INDEX, {
      printerModel: "COREONEL",
      index,
    });
    expect(forL.some((c) => c.name === "Prusament PLA @MK4S")).toBe(false);
    // Universal "Prusament PLA" still shows for CORE One L.
    expect(forL.some((c) => c.name === "Prusament PLA")).toBe(true);

    const forMk4s = listConvertibleProfiles(graph, ORCA_FILAMENT_PROFILE_INDEX, {
      printerModel: "MK4S",
      index,
    });
    expect(forMk4s.some((c) => c.name === "Prusament PLA @MK4S")).toBe(true);
  });

  it("includes deny-only profiles for any printer they don't exclude", () => {
    // `printer_model!="MK3.5"` -> compatible with everything except MK3.5.
    for (const model of ["COREONEL", "MK4S"]) {
      const list = listConvertibleProfiles(graph, ORCA_FILAMENT_PROFILE_INDEX, {
        printerModel: model,
        index,
      });
      expect(list.some((c) => c.name === "Prusament PETG @Universal")).toBe(true);
    }
  });
});

describe("selectable export (list cheaply, convert only what's chosen)", () => {
  const candidates = listConvertibleProfiles(graph, ORCA_FILAMENT_PROFILE_INDEX);

  it("lists concrete profiles without converting, flagging already-in-Orca", () => {
    const abs = candidates.find((c) => c.name === "Generic ABS @COREONE HF0.6");
    expect(abs!.alreadyInOrca).toBe(true);
    expect(abs!.orcaMatch).toBe("Prusa Generic ABS @CORE One HF 0.6");
    expect(candidates.some((c) => c.name === "*PLA*")).toBe(false); // abstract excluded
  });

  it("converts only the names you select", () => {
    const out = convertSelectedVendorProfiles(graph, ORCA_FILAMENT_PROFILE_INDEX, [
      "Prusament PLA @MK4S",
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.profile.name).toBe("Prusament PLA @MK4S");
    expect(out[0]!.strategy).toBe("flatten");
    expect(out[0]!.stats.droppedInvalid).toBe(0);
  });

  it("honors the printer filter when listing", () => {
    const coreOnly = listConvertibleProfiles(graph, ORCA_FILAMENT_PROFILE_INDEX, {
      printerFilter: ["CORE One HF 0.6"],
    });
    expect(coreOnly.some((c) => c.name === "Prusament PLA @MK4S")).toBe(false);
  });
});

describe("user export still re-links with vendor context present", () => {
  it("the real ABS export re-links (Orca has its parent) rather than flattening", () => {
    const ctx = createContext({ vendorText: read("vendor_mini.ini") });
    const [abs] = convertIniToOrcaFilaments(read("PrusaSlicer_config_bundle.ini"), undefined, ctx);
    expect(abs!.strategy).toBe("relink");
    expect(abs!.profile.inherits).toBe("Prusa Generic ABS @CORE One HF 0.6");
  });
});

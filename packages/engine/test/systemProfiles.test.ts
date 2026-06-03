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

  it("FLATTENS a multi-parent profile into a standalone (no inherits)", () => {
    const r = convertFilamentProfile(node("Prusament PLA @MK4S"), ctx);
    expect(r.strategy).toBe("flatten");
    expect(r.profile.inherits).toBeUndefined();
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

describe("user export still re-links with vendor context present", () => {
  it("the real ABS export re-links (Orca has its parent) rather than flattening", () => {
    const ctx = createContext({ vendorText: read("vendor_mini.ini") });
    const [abs] = convertIniToOrcaFilaments(read("PrusaSlicer_config_bundle.ini"), undefined, ctx);
    expect(abs!.strategy).toBe("relink");
    expect(abs!.profile.inherits).toBe("Prusa Generic ABS @CORE One HF 0.6");
  });
});

// Orchestrator: PrusaProfile -> ConversionResult.
//
// The strategy depends on what resolution context we're given:
//   1. RE-LINK  — a single parent that OrcaSlicer already ships. Emit only this
//      profile's diff and point `inherits` at the Orca preset. Smallest, and it
//      rides Orca's maintained values.
//   2. FLATTEN  — no Orca match (or multi-parent). Resolve the full parent chain
//      from the vendor graph and inline every value into a standalone profile.
//   3. DIFF-ONLY — no context at all (legacy). Emit the diff with a best-effort
//      `inherits` name, flagged when uncertain.

import type {
  PrusaProfile,
  ConversionResult,
  ConversionStrategy,
  InheritsStatus,
  ReportEntry,
  ResolutionContext,
} from "./types.js";
import { transformFilament } from "./transform/filament.js";
import { resolveInherits } from "./transform/inherits.js";
import { matchOrcaProfile } from "./transform/orcaMatch.js";
import { flatten } from "./transform/resolveGraph.js";
import { parseInherits } from "./ingest/vendorBundle.js";
import { validateFilamentValues } from "./validate/validate.js";
import { emitFilament, suggestFilename } from "./emit/emitFilament.js";

export function convertFilamentProfile(
  profile: PrusaProfile,
  ctx: ResolutionContext = {},
): ConversionResult {
  const parents = parseInherits(profile.inherits);

  // 1) RE-LINK: a single parent OrcaSlicer already ships.
  if (parents.length === 1 && ctx.orca) {
    const orca = matchOrcaProfile(parents[0]!, ctx.orca);
    if (orca) {
      return finish(
        profile,
        profile.settings,
        { kind: "resolved", orca, prusa: parents[0]! },
        "relink",
        [
          {
            severity: "info",
            message: `Re-linked to Orca preset "${orca}" — only your overrides are emitted; Orca supplies the rest.`,
          },
        ],
      );
    }
  }

  // 2) FLATTEN: resolve the full parent chain from the vendor graph.
  if (parents.length > 0 && ctx.vendor) {
    const f = flatten(ctx.vendor, parents, profile.settings);
    const extra: ReportEntry[] = [
      {
        severity: "info",
        message:
          f.chain.length > 0
            ? `Flattened ${f.chain.length} parent profile(s) into a standalone profile (${f.chain.join(" → ")}).`
            : `Emitted as a standalone profile.`,
      },
    ];
    for (const m of f.missing) {
      extra.push({
        severity: "warn",
        message: `Parent "${m}" was not found in the vendor bundle — its values could not be inlined.`,
      });
    }
    return finish(
      profile,
      f.settings,
      { kind: "flattened", from: f.chain, missing: f.missing },
      "flatten",
      extra,
    );
  }

  // 3) DIFF-ONLY (legacy): best-effort name resolution, emit the diff as-is.
  const inherits = resolveInherits(profile.inherits, ctx.orca);
  const extra: ReportEntry[] =
    inherits.kind === "carried"
      ? [
          {
            severity: "warn",
            message: `Could not match parent "${inherits.raw}" to an Orca preset — carried verbatim; verify it exists in OrcaSlicer.`,
          },
        ]
      : [];
  return finish(profile, profile.settings, inherits, "diff-only", extra);
}

/** Run transform -> validate -> emit over a chosen set of source settings. */
function finish(
  profile: PrusaProfile,
  settings: Record<string, string>,
  inherits: InheritsStatus,
  strategy: ConversionStrategy,
  extraReport: ReportEntry[],
): ConversionResult {
  const synthetic: PrusaProfile = { ...profile, settings, inherits: undefined };
  const t = transformFilament(synthetic);
  const v = validateFilamentValues(t.values);
  const orca = emitFilament(profile.name, v.kept, inherits);

  return {
    profile: orca,
    filename: suggestFilename(profile.name),
    report: [...extraReport, ...t.report, ...v.report],
    inherits,
    strategy,
    stats: {
      mapped: t.stats.mapped,
      droppedNoMapping: t.stats.droppedNoMapping,
      nilSkipped: t.stats.nilSkipped,
      droppedInvalid: v.droppedInvalid,
    },
  };
}

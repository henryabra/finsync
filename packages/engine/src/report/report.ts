// Module 8: render a human-readable conversion report — the trust layer.

import type { ConversionResult, ReportEntry } from "../types.js";

export function formatReport(result: ConversionResult): string {
  const { profile, inherits, stats, report } = result;
  const lines: string[] = [];
  lines.push(`# Conversion report: ${profile.name}`);
  lines.push("");
  lines.push(
    `mapped=${stats.mapped}  dropped(no-mapping)=${stats.droppedNoMapping}  ` +
      `nil-skipped=${stats.nilSkipped}  dropped(invalid)=${stats.droppedInvalid}`,
  );

  switch (inherits.kind) {
    case "resolved":
      lines.push(`inherits: "${inherits.prusa}" -> "${inherits.orca}" (auto-resolved — verify it exists in your Orca)`);
      break;
    case "carried":
      lines.push(`inherits: "${inherits.raw}" CARRIED VERBATIM ⚠ — this parent likely does not exist in Orca. Re-select a base preset after import, or the profile may be missing inherited values.`);
      break;
    case "none":
      lines.push("inherits: none (standalone profile)");
      break;
  }

  const bySeverity = (s: ReportEntry["severity"]) => report.filter((r) => r.severity === s);
  for (const sev of ["error", "warn", "info"] as const) {
    const items = bySeverity(sev);
    if (items.length === 0) continue;
    lines.push("");
    lines.push(`## ${sev} (${items.length})`);
    for (const r of items) lines.push(`  - ${r.message}`);
  }
  return lines.join("\n");
}

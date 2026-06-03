#!/usr/bin/env tsx
// Minimal CLI: convert PrusaSlicer .ini filament profiles to Orca .json.
//   tsx bin/cli.ts <input.ini> [--out <dir>]

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { convertIniToOrcaFilaments, formatReport } from "../src/index.js";

function main(argv: string[]): void {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    console.log("Usage: tsx bin/cli.ts <input.ini> [--out <dir>]");
    process.exit(args.length === 0 ? 1 : 0);
  }
  const outIdx = args.indexOf("--out");
  const outDir = outIdx !== -1 ? args[outIdx + 1] : undefined;
  const input = args[0]!;

  const text = readFileSync(input, "utf8");
  const results = convertIniToOrcaFilaments(text, basename(input));

  if (results.length === 0) {
    console.error(`No filament profiles found in ${input}`);
    process.exit(2);
  }

  if (outDir) mkdirSync(outDir, { recursive: true });
  for (const r of results) {
    const json = JSON.stringify(r.profile, null, 2);
    if (outDir) {
      writeFileSync(join(outDir, r.filename), json);
      console.log(`✓ ${r.filename}`);
    }
    console.log(formatReport(r));
    console.log("");
  }
  console.log(`Converted ${results.length} filament profile(s).`);
}

main(process.argv);

# finsync

A **proven, up-to-date** PrusaSlicer → OrcaSlicer profile migration engine, plus a
browser UI on top. Fills the gap the existing tools leave: OrcaSlicer refuses to
import `.ini` natively, theophile's reference Perl script is proven but frozen at
Orca 1.6 / 2024, and the other GUI converter is stuck on Orca 1.6 too.

## The core idea

Two things pull in opposite directions, so they live in separate layers:

- **Proven** — the *mapping rules* (`packages/engine/src/mapping/`), seeded from the
  battle-tested reference converter and frozen by a regression test corpus built from
  **real** exported profiles.
- **Up-to-date** — the *target schema* (`packages/engine/src/schema/`), **regenerated
  from the live OrcaSlicer repo** by `packages/schema-sync`. New Orca releases update
  the schema; the engine even uses it to pass through keys that are identical in both
  slicers, so coverage grows as Orca evolves instead of rotting.

## Status (MVP: filament profiles)

Working end-to-end and tested against real exported profiles:

- ✅ Ingest: single "Export Config" (flat) **and** "Export Config Bundle" (`[filament:…]`)
- ✅ Proven value transforms: `nil`→inherit, `bed_temperature`→4 plate types, fan/cooling
  renames, `filament_type` aliasing, `max_volumetric_speed`=0 substitution, g-code un-escaping
- ✅ Inheritance resolver: Prusa system parent → Orca preset name (best-effort, flagged when unsure)
- ✅ Live-schema validation + **identity passthrough** (schema-sync discovered 15 extra 1:1 keys)
- ✅ Per-profile conversion report (the trust layer — every drop/clamp is listed)
- ✅ Emits correct Orca filament JSON (single-element string arrays, `from: User`)

### Web UI (`packages/web`) — shipped

A zero-install browser app over the engine: drag a Prusa `.ini` (or several) in,
get per-profile conversion cards — mapped/dropped/nil/invalid stats, the full
conversion report, inheritance status, JSON preview, and per-file or
**Download all (.zip)** output. The engine runs 100% client-side; nothing is
uploaded. Built with Vite + React + Tailwind, the engine imported straight from
source (no separate build step).

```bash
npm install
npm run dev --workspace @finsync/web    # http://localhost:5173
```

Next: print + printer/machine profiles, then full-bundle one-shot — all behind the same UI.

## Use it

```bash
npm install
# convert a Prusa .ini's filament profiles to Orca .json + print the report
npm run convert -- path/to/PrusaSlicer_config_bundle.ini --out ./out

npm test                 # runs the engine suite against real fixtures
# refresh the Orca target schema from the live repo (the "up-to-date" engine):
node_modules/.bin/tsx packages/schema-sync/src/sync.ts --vendor Prusa
```

## Layout

```
packages/engine/      @finsync/engine — headless, pure TS, runs in Node AND browser
  src/ingest/         .ini parser + IR extraction
  src/mapping/        proven mapping table (data, not code)
  src/schema/         Orca target schema (curated ∪ generated)
  src/transform/      value transforms, g-code, inheritance
  src/validate/       output checked against live Orca schema
  src/emit/ report/   Orca JSON + conversion report
  test/fixtures/      real exported Prusa profiles (regression corpus)
packages/schema-sync/ regenerates the Orca schema from the live OrcaSlicer repo
packages/web/         client-side browser app (Vite + React + Tailwind) importing the engine
```

MIT.

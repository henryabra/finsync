import { useMemo, useState } from "react";
import {
  convertSelectedVendorProfiles,
  ORCA_FILAMENT_PROFILE_INDEX,
  type VendorGraph,
  type LibraryProfileInfo,
} from "@finsync/engine";
import { downloadZip } from "../lib/download.ts";

export interface YourItem {
  filename: string;
  name: string;
  json: string;
}

const RENDER_CAP = 300;

// The single download surface: your profiles (checked by default) plus any
// system profiles you tick on. You pick what goes in the zip — it isn't an
// all-or-nothing library dump.
export function ExportPanel({
  yourItems,
  graph,
  systemCandidates,
  printerLabel,
}: {
  yourItems: YourItem[];
  graph?: VendorGraph;
  systemCandidates: LibraryProfileInfo[];
  printerLabel: string;
}) {
  const [excludedYours, setExcludedYours] = useState<Set<string>>(new Set());
  const [selectedSystem, setSelectedSystem] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const filteredSystem = useMemo(() => {
    const q = query.toLowerCase().trim();
    return q
      ? systemCandidates.filter((c) => c.name.toLowerCase().includes(q))
      : systemCandidates;
  }, [systemCandidates, query]);

  const yoursIncluded = yourItems.filter((i) => !excludedYours.has(i.filename));
  const selectedCount = yoursIncluded.length + selectedSystem.size;

  const toggleYours = (f: string) =>
    setExcludedYours((s) => {
      const n = new Set(s);
      n.has(f) ? n.delete(f) : n.add(f);
      return n;
    });

  const toggleSystem = (name: string) =>
    setSelectedSystem((s) => {
      const n = new Set(s);
      n.has(name) ? n.delete(name) : n.add(name);
      return n;
    });

  const selectAllFiltered = () =>
    setSelectedSystem((s) => new Set([...s, ...filteredSystem.map((c) => c.name)]));
  const clearSystem = () => setSelectedSystem(new Set());

  const download = () => {
    const files = yoursIncluded.map((i) => ({ filename: i.filename, content: i.json }));
    const used = new Set(files.map((f) => f.filename));
    if (graph && selectedSystem.size) {
      const converted = convertSelectedVendorProfiles(
        graph,
        ORCA_FILAMENT_PROFILE_INDEX,
        selectedSystem,
      );
      for (const r of converted) {
        if (used.has(r.filename)) continue; // your customised profile wins on a name clash
        files.push({ filename: r.filename, content: JSON.stringify(r.profile, null, 4) });
        used.add(r.filename);
      }
    }
    if (files.length) downloadZip(files, "orca-filaments.zip");
  };

  if (yourItems.length === 0 && systemCandidates.length === 0) return null;

  return (
    <section className="rounded-xl border border-emerald-700/40 bg-emerald-500/[0.04] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Export</h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            Pick what goes in the download. Your profiles are included by default; tick on any
            system profiles you want too.
          </p>
        </div>
        <button
          onClick={download}
          disabled={selectedCount === 0}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {selectedCount === 0
            ? "Select profiles to download"
            : `Download ${selectedCount} selected (.zip)`}
        </button>
      </div>
      {selectedCount === 0 && (
        <p className="mt-2 text-xs text-amber-300/90">
          Nothing selected yet — tick your profiles{graph ? " or any system profiles below" : ""} to
          enable the download.
        </p>
      )}

      {/* Your profiles */}
      {yourItems.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Your profiles ({yoursIncluded.length}/{yourItems.length})
          </div>
          <ul className="space-y-1">
            {yourItems.map((i) => (
              <li key={i.filename}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-zinc-800/50">
                  <input
                    type="checkbox"
                    checked={!excludedYours.has(i.filename)}
                    onChange={() => toggleYours(i.filename)}
                    className="accent-emerald-500"
                  />
                  <span className="text-zinc-200">{i.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* System profiles */}
      {graph && (
        <div className="mt-4">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Add system profiles{printerLabel ? ` · ${printerLabel}` : ""} (
              {selectedSystem.size} of {systemCandidates.length} selected)
            </span>
            <span className="flex gap-2 text-xs">
              <button onClick={selectAllFiltered} className="text-emerald-400 hover:underline">
                Select{query ? " matching" : " all"}
              </button>
              {selectedSystem.size > 0 && (
                <button onClick={clearSystem} className="text-zinc-400 hover:underline">
                  Clear
                </button>
              )}
            </span>
          </div>

          {systemCandidates.length === 0 ? (
            <p className="text-xs text-zinc-500">
              No system profiles to add for this printer (Orca may already ship them, or none match).
            </p>
          ) : (
            <>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search system profiles… e.g. Prusament PETG"
                className="mb-2 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500"
              />
              <ul className="max-h-72 space-y-0.5 overflow-auto rounded-md border border-zinc-800 bg-zinc-950/40 p-1">
                {filteredSystem.slice(0, RENDER_CAP).map((c) => (
                  <li key={c.name}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-zinc-800/50">
                      <input
                        type="checkbox"
                        checked={selectedSystem.has(c.name)}
                        onChange={() => toggleSystem(c.name)}
                        className="accent-emerald-500"
                      />
                      <span className="text-zinc-300">{c.name}</span>
                    </label>
                  </li>
                ))}
                {filteredSystem.length > RENDER_CAP && (
                  <li className="px-2 py-1 text-xs text-zinc-500">
                    …and {filteredSystem.length - RENDER_CAP} more — refine your search to see them.
                  </li>
                )}
                {filteredSystem.length === 0 && (
                  <li className="px-2 py-1 text-xs text-zinc-500">No match for “{query}”.</li>
                )}
              </ul>
            </>
          )}
        </div>
      )}

      <details className="mt-4 rounded-lg bg-zinc-950/40 p-3 text-xs text-zinc-400">
        <summary className="cursor-pointer font-medium text-zinc-300">
          After downloading — how to install in OrcaSlicer
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>Unzip the downloaded file.</li>
          <li>
            Move the <code className="text-zinc-300">.json</code> files into OrcaSlicer’s filament
            folder:
            <ul className="mt-1 space-y-0.5">
              <li>
                macOS:{" "}
                <code className="text-zinc-300">
                  ~/Library/Application Support/OrcaSlicer/user/default/filament/
                </code>
              </li>
              <li>
                Windows:{" "}
                <code className="text-zinc-300">%APPDATA%\OrcaSlicer\user\default\filament\</code>
              </li>
              <li>
                Linux: <code className="text-zinc-300">~/.config/OrcaSlicer/user/default/filament/</code>
              </li>
            </ul>
          </li>
          <li>
            Restart OrcaSlicer — the profiles appear in the Filament dropdown under your user presets.
          </li>
        </ol>
        <p className="mt-2 text-zinc-500">
          Tip: this drop-in method always works. OrcaSlicer’s <em>File ▸ Import ▸ Import Configs</em>
          can say “0 configs imported” when a profile is tied to a printer you haven’t added — the
          folder method skips that check.
        </p>
      </details>
    </section>
  );
}

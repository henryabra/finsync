import { useMemo, useRef, useState } from "react";
import {
  convertIniToOrcaFilaments,
  parseIni,
  detectSource,
  schemaSource,
  createContext,
  type ResolutionContext,
} from "@finsync/engine";
import { Dropzone } from "./components/Dropzone.tsx";
import { ResultCard } from "./components/ResultCard.tsx";
import { SystemProfiles } from "./components/SystemProfiles.tsx";
import { downloadZip } from "./lib/download.ts";
import sampleIni from "../../engine/test/fixtures/PrusaSlicer_config_bundle.ini?raw";

interface RawInput {
  id: number;
  name: string;
  text: string;
}

export function App() {
  const [inputs, setInputs] = useState<RawInput[]>([]);
  const [vendor, setVendor] = useState<{ name: string; text: string } | null>(null);
  // Bumped on Clear so an in-flight File.text() batch can't repopulate after it.
  const generation = useRef(0);
  // useRef (not a module-level counter) so HMR can't reset ids while state persists.
  const nextId = useRef(1);

  // Re-linking to Orca presets is always on; a loaded vendor bundle enables
  // flattening for parents Orca doesn't ship. Conversions re-run when it changes.
  const ctx = useMemo<ResolutionContext>(
    () => createContext({ vendorText: vendor?.text, vendorFile: vendor?.name }),
    [vendor],
  );

  const entries = useMemo(
    () =>
      inputs.map((i) => {
        const parsed = parseIni(i.text);
        const src = detectSource(parsed.header, i.name);
        const sourceLabel = src.version ? `${src.slicer} ${src.version}` : src.slicer;
        return { ...i, sourceLabel, results: convertIniToOrcaFilaments(i.text, i.name, ctx) };
      }),
    [inputs, ctx],
  );

  const addTexts = (items: { name: string; text: string }[]) => {
    const added = items.map((i): RawInput => ({ id: nextId.current++, ...i }));
    setInputs((prev) => [...prev, ...added]);
  };

  const onFiles = async (files: File[]) => {
    const gen = generation.current;
    let items: { name: string; text: string }[];
    try {
      items = await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() })));
    } catch (err) {
      console.error("finsync: failed to read dropped file(s)", err);
      return;
    }
    if (generation.current !== gen) return; // cleared (or superseded) mid-read
    addTexts(items);
  };

  const onSample = () =>
    addTexts([{ name: "PrusaSlicer_config_bundle.ini (sample)", text: sampleIni }]);

  const allResults = useMemo(() => entries.flatMap((e) => e.results), [entries]);
  const totals = useMemo(
    () =>
      allResults.reduce(
        (acc, r) => {
          acc.mapped += r.stats.mapped;
          acc.invalid += r.stats.droppedInvalid;
          acc.review += r.report.filter((x) => x.severity !== "info").length;
          return acc;
        },
        { mapped: 0, invalid: 0, review: 0 },
      ),
    [allResults],
  );

  const downloadAll = () =>
    downloadZip(
      allResults.map((r) => ({
        filename: r.filename,
        content: JSON.stringify(r.profile, null, 4),
      })),
    );

  const hasEntries = entries.length > 0;

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-6 px-5 py-10">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            fin<span className="text-emerald-400">sync</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            PrusaSlicer → OrcaSlicer filament migrator
          </p>
        </div>
        <div
          title={schemaSource.generatedFrom}
          className="text-right text-[11px] leading-tight text-zinc-500"
        >
          <div>Orca schema</div>
          <div className="font-mono text-zinc-400">{schemaSource.orcaProfileVersion}</div>
        </div>
      </header>

      <Dropzone onFiles={onFiles} onSample={onSample} compact={hasEntries} />

      <SystemProfiles
        vendorName={vendor?.name}
        graph={ctx.vendor}
        onLoad={(name, text) => setVendor({ name, text })}
        onClear={() => setVendor(null)}
      />

      {hasEntries && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
            <div className="text-sm text-zinc-300">
              <span className="font-semibold text-zinc-100">{allResults.length}</span>{" "}
              filament profile{allResults.length === 1 ? "" : "s"} ·{" "}
              <span className="text-emerald-300">{totals.mapped}</span> keys mapped
              {totals.review > 0 && (
                <>
                  {" "}
                  · <span className="text-amber-300">{totals.review}</span> to review
                </>
              )}
              {totals.invalid > 0 && (
                <>
                  {" "}
                  · <span className="text-red-300">{totals.invalid}</span> invalid dropped
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  generation.current++;
                  setInputs([]);
                }}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800"
              >
                Clear
              </button>
              {allResults.length > 0 && (
                <button
                  onClick={downloadAll}
                  className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400"
                >
                  Download all (.zip)
                </button>
              )}
            </div>
          </div>

          {entries.map((entry) => (
            <section key={entry.id} className="flex flex-col gap-3">
              <div className="flex items-baseline gap-2 text-xs text-zinc-500">
                <span className="font-mono text-zinc-400">{entry.name}</span>
                <span>·</span>
                <span>{entry.sourceLabel}</span>
              </div>
              {entry.results.length === 0 ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
                  No filament profiles found in this file. It may be a print or printer
                  config — those aren’t supported yet.
                </div>
              ) : (
                entry.results.map((r, i) => <ResultCard key={i} result={r} />)
              )}
            </section>
          ))}
        </>
      )}

      <footer className="mt-auto pt-6 text-center text-xs text-zinc-600">
        Runs entirely in your browser. Nothing is uploaded. ·{" "}
        <span className="font-mono">@finsync/engine</span>
      </footer>
    </div>
  );
}

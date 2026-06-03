import { useMemo, useRef, useState } from "react";
import {
  convertVendorLibrary,
  listPrinterVariants,
  fetchPrusaVendorBundle,
  PRUSA_VENDOR_REFS,
  DEFAULT_PRUSA_REF,
  ORCA_FILAMENT_PROFILE_INDEX,
  type VendorGraph,
  type LibraryEntry,
} from "@finsync/engine";
import { downloadZip } from "../lib/download.ts";
import { VariantPicker } from "./VariantPicker.tsx";

const PRUSA_INI_PATH =
  "~/Library/Application Support/PrusaSlicer/vendor/PrusaResearch.ini";

export function SystemProfiles({
  vendorName,
  graph,
  onLoad,
  onClear,
}: {
  vendorName?: string;
  graph?: VendorGraph;
  onLoad: (name: string, text: string) => void;
  onClear: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState("CORE One HF 0.6");
  const [lib, setLib] = useState<LibraryEntry[] | null>(null);
  const [ref, setRef] = useState(DEFAULT_PRUSA_REF);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    onLoad(file.name, await file.text());
    setLib(null);
  };

  const fetchFromPrusa = async () => {
    setFetching(true);
    setFetchError(null);
    try {
      const b = await fetchPrusaVendorBundle(ref);
      const ver = b.configVersion ? ` · v${b.configVersion}` : "";
      onLoad(`PrusaResearch.ini @ ${ref}${ver}`, b.text);
      setLib(null);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Fetch failed.");
    } finally {
      setFetching(false);
    }
  };

  const convert = () => {
    if (!graph) return;
    const tokens = filter
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setLib(
      convertVendorLibrary(graph, ORCA_FILAMENT_PROFILE_INDEX, {
        printerFilter: tokens.length ? tokens : undefined,
      }),
    );
  };

  const variants = useMemo(() => (graph ? listPrinterVariants(graph) : []), [graph]);

  const summary = useMemo(() => {
    if (!lib) return null;
    const converted = lib.filter((e) => e.converted);
    return {
      converted: converted.length,
      inOrca: lib.filter((e) => e.skipped === "already-in-orca").length,
      filtered: lib.filter((e) => e.skipped === "printer-filter").length,
      files: converted.map((e) => ({
        filename: e.result!.filename,
        content: JSON.stringify(e.result!.profile, null, 4),
      })),
      invalid: converted.reduce((n, e) => n + e.result!.stats.droppedInvalid, 0),
    };
  }, [lib]);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">System profiles (Prusament &amp; friends)</h2>
          <p className="mt-1 text-xs text-zinc-400">
            PrusaSlicer doesn’t export its built-in profiles. Add your vendor bundle to
            complete inherited profiles <em>and</em> convert the whole library.
          </p>
        </div>
        {graph && (
          <button
            onClick={() => {
              onClear();
              setLib(null);
            }}
            className="shrink-0 rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
          >
            Remove
          </button>
        )}
      </div>

      {!graph ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              disabled={fetching}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            >
              {PRUSA_VENDOR_REFS.map((r) => (
                <option key={r.ref} value={r.ref}>
                  {r.label}
                </option>
              ))}
            </select>
            <button
              onClick={fetchFromPrusa}
              disabled={fetching}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              {fetching ? "Fetching…" : "Fetch from Prusa"}
            </button>
            <span className="text-xs text-zinc-600">or</span>
            <button
              onClick={() => input.current?.click()}
              className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
            >
              Load a local file…
            </button>
          </div>
          <input
            ref={input}
            type="file"
            accept=".ini,text/plain"
            hidden
            onChange={(e) => {
              loadFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {fetchError && (
            <p className="text-xs text-red-300">
              {fetchError} You can still load the file locally.
            </p>
          )}
          <p className="text-xs text-zinc-500">
            Fetches from prusa3d/PrusaSlicer (GitHub). Your locally-installed copy at{" "}
            <code className="text-zinc-400">{PRUSA_INI_PATH}</code> may be a touch newer.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="text-xs text-zinc-400">
            Loaded <span className="font-mono text-zinc-300">{vendorName}</span> ·{" "}
            <span className="text-emerald-300">{graph.nodes.size.toLocaleString()}</span> profiles.
            Inherited profiles in your export now flatten automatically when Orca lacks the parent.
          </div>

          <div className="rounded-lg bg-zinc-950/40 p-3">
            <p className="mb-2 text-xs text-zinc-400">
              Turn Prusa’s built-in filament profiles into OrcaSlicer files you can import.
              Pick <strong>your printer &amp; nozzle</strong> below — the number next to each is
              how many profiles match. Choose <em>All printers</em> to convert everything.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[16rem] flex-1">
                <span className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">
                  My printer &amp; nozzle
                </span>
                <VariantPicker variants={variants} value={filter} onChange={setFilter} />
              </label>
              <button
                onClick={convert}
                className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
              >
                Convert library
              </button>
            </div>
          </div>

          {summary && (
            <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-medium text-zinc-100">
                  <span className="text-emerald-300">{summary.converted}</span> filament profiles
                  ready to import
                </span>
                {summary.converted > 0 && (
                  <button
                    onClick={() => downloadZip(summary.files, "orca-system-filaments.zip")}
                    className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400"
                  >
                    Download .zip
                  </button>
                )}
              </div>
              <ul className="space-y-1 text-xs text-zinc-400">
                <li>
                  <span className="font-semibold text-emerald-300">{summary.converted}</span>{" "}
                  converted to Orca files — in the download. Unzip into OrcaSlicer’s filament
                  folder, or import each from OrcaSlicer.
                </li>
                <li>
                  <span className="font-semibold text-zinc-300">{summary.inOrca}</span> skipped —
                  OrcaSlicer already ships these, so you don’t need them.
                </li>
                {summary.filtered > 0 && (
                  <li>
                    <span className="font-semibold text-zinc-300">
                      {summary.filtered.toLocaleString()}
                    </span>{" "}
                    skipped — they’re for other printers/nozzles. Edit the box above to include them.
                  </li>
                )}
                {summary.invalid > 0 && (
                  <li>
                    <span className="font-semibold text-red-300">{summary.invalid}</span> values
                    dropped — not understood by your Orca version (the profiles still import fine).
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

import { useMemo, useRef, useState } from "react";
import {
  listPrinterVariants,
  PRUSA_VENDOR_REFS,
  DEFAULT_PRUSA_REF,
  type VendorGraph,
} from "@finsync/engine";
import { VariantPicker } from "./VariantPicker.tsx";
import { fetchPrusaBundleCached, getCacheMeta, clearPrusaCache } from "../lib/prusaCache.ts";

function ago(ts: number): string {
  if (!ts) return "";
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const PRUSA_INI_PATH =
  "~/Library/Application Support/PrusaSlicer/vendor/PrusaResearch.ini";

export function SystemProfiles({
  vendorName,
  graph,
  printer,
  onPrinterChange,
  onLoad,
  onClear,
}: {
  vendorName?: string;
  graph?: VendorGraph;
  printer: string;
  onPrinterChange: (v: string) => void;
  onLoad: (name: string, text: string) => void;
  onClear: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [ref, setRef] = useState(DEFAULT_PRUSA_REF);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [cacheTick, setCacheTick] = useState(0);

  const cached = useMemo(() => getCacheMeta(ref), [ref, cacheTick]);

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    onLoad(file.name, await file.text());
  };

  const fetchFromPrusa = async (force = false) => {
    setFetching(true);
    setFetchError(null);
    try {
      const b = await fetchPrusaBundleCached(ref, force);
      const ver = b.configVersion ? ` · v${b.configVersion}` : "";
      const tag = b.fromCache ? " (cached)" : "";
      onLoad(`PrusaResearch.ini @ ${ref}${ver}${tag}`, b.text);
      setCacheTick((t) => t + 1);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Fetch failed.");
    } finally {
      setFetching(false);
    }
  };

  const clearCache = async () => {
    await clearPrusaCache();
    setCacheTick((t) => t + 1);
  };

  const variants = useMemo(() => (graph ? listPrinterVariants(graph) : []), [graph]);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">
            System profiles source (Prusament &amp; friends)
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            PrusaSlicer doesn’t export its built-in profiles. Load Prusa’s bundle to
            <em> complete</em> the profiles you drop above, and to pick system profiles to add
            in the Export box below.
          </p>
        </div>
        {graph && (
          <button
            onClick={onClear}
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
              onClick={() => fetchFromPrusa(false)}
              disabled={fetching}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              {fetching ? "Loading…" : cached ? "Load cached" : "Fetch from Prusa"}
            </button>
            <span className="text-xs text-zinc-600">or</span>
            <button
              onClick={() => input.current?.click()}
              className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
            >
              Load a local file…
            </button>
          </div>
          {cached && (
            <p className="text-xs text-emerald-300/90">
              ✓ Cached{cached.configVersion ? ` v${cached.configVersion}` : ""}
              {cached.cachedAt ? ` · ${ago(cached.cachedAt)}` : ""} — loads instantly &amp; offline.{" "}
              <button
                onClick={() => fetchFromPrusa(true)}
                disabled={fetching}
                className="text-emerald-400 hover:underline disabled:opacity-60"
              >
                Refresh from GitHub
              </button>{" "}
              ·{" "}
              <button onClick={clearCache} className="text-zinc-400 hover:underline">
                Clear cache
              </button>
            </p>
          )}
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
        <div className="mt-4 space-y-3">
          <div className="text-xs text-zinc-400">
            Loaded <span className="font-mono text-zinc-300">{vendorName}</span> ·{" "}
            <span className="text-emerald-300">{graph.nodes.size.toLocaleString()}</span> profiles.
            Profiles you drop above now complete themselves from this bundle.
          </div>
          <label className="block max-w-md">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">
              My printer &amp; nozzle (filters the Export list below)
            </span>
            <VariantPicker variants={variants} value={printer} onChange={onPrinterChange} />
          </label>
        </div>
      )}
    </section>
  );
}

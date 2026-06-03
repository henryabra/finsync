import { useMemo, useState } from "react";
import type { ConversionResult, ReportEntry, InheritsStatus } from "@finsync/engine";
import { downloadBlob } from "../lib/download.ts";

const SEV_STYLE: Record<ReportEntry["severity"], string> = {
  info: "border-zinc-700 bg-zinc-800/40 text-zinc-300",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  error: "border-red-500/50 bg-red-500/10 text-red-200",
};

const SEV_LABEL: Record<ReportEntry["severity"], string> = {
  info: "info",
  warn: "warn",
  error: "error",
};

function InheritsBadge({ inherits }: { inherits: InheritsStatus }) {
  if (inherits.kind === "resolved")
    return (
      <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
        inherits → {inherits.orca}
      </span>
    );
  if (inherits.kind === "carried")
    return (
      <span
        title="Parent name carried over verbatim — verify it exists in OrcaSlicer."
        className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-300"
      >
        inherits (verify) → {inherits.raw}
      </span>
    );
  return (
    <span className="rounded-full bg-zinc-700/50 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
      no parent
    </span>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "neutral" | "bad";
}) {
  const color =
    tone === "good"
      ? "text-emerald-300"
      : tone === "bad"
        ? value > 0
          ? "text-red-300"
          : "text-zinc-500"
        : "text-zinc-300";
  return (
    <div className="flex flex-col items-center rounded-lg bg-zinc-900/60 px-3 py-2">
      <span className={`text-lg font-semibold tabular-nums ${color}`}>{value}</span>
      <span className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</span>
    </div>
  );
}

export function ResultCard({ result }: { result: ConversionResult }) {
  const [showJson, setShowJson] = useState(false);
  const [showReport, setShowReport] = useState(true);
  const [copied, setCopied] = useState(false);

  const json = useMemo(() => JSON.stringify(result.profile, null, 4), [result]);
  const warnings = result.report.filter((r) => r.severity !== "info").length;

  const copy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-zinc-100">
            {result.profile.name}
          </h3>
          <p className="mt-0.5 font-mono text-xs text-zinc-500">{result.filename}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copy}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
          >
            {copied ? "Copied ✓" : "Copy JSON"}
          </button>
          <button
            onClick={() => downloadBlob(result.filename, json)}
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400"
          >
            Download
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <InheritsBadge inherits={result.inherits} />
        {warnings > 0 && (
          <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-300">
            {warnings} thing{warnings === 1 ? "" : "s"} to review
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <Stat label="mapped" value={result.stats.mapped} tone="good" />
        <Stat label="no map" value={result.stats.droppedNoMapping} tone="neutral" />
        <Stat label="nil" value={result.stats.nilSkipped} tone="neutral" />
        <Stat label="invalid" value={result.stats.droppedInvalid} tone="bad" />
      </div>

      <div className="mt-4">
        <button
          onClick={() => setShowReport((v) => !v)}
          className="text-xs font-medium text-zinc-400 hover:text-zinc-200"
        >
          {showReport ? "▾" : "▸"} Conversion report ({result.report.length})
        </button>
        {showReport && (
          <ul className="mt-2 space-y-1.5">
            {result.report.map((entry, i) => (
              <li
                key={i}
                className={`rounded-md border px-3 py-1.5 text-xs ${SEV_STYLE[entry.severity]}`}
              >
                <span className="mr-2 font-mono text-[10px] uppercase opacity-70">
                  {SEV_LABEL[entry.severity]}
                </span>
                {entry.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3">
        <button
          onClick={() => setShowJson((v) => !v)}
          className="text-xs font-medium text-zinc-400 hover:text-zinc-200"
        >
          {showJson ? "▾" : "▸"} Orca JSON
        </button>
        {showJson && (
          <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
            {json}
          </pre>
        )}
      </div>
    </div>
  );
}

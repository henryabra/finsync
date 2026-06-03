import { useRef, useState } from "react";

export function Dropzone({
  onFiles,
  onSample,
  compact,
}: {
  onFiles: (files: File[]) => void;
  onSample: () => void;
  compact?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const pick = (list: FileList | null) => {
    if (list && list.length) onFiles(Array.from(list));
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        pick(e.dataTransfer.files);
      }}
      className={`rounded-2xl border-2 border-dashed text-center transition ${
        compact ? "p-6" : "p-12"
      } ${
        hover
          ? "border-emerald-400 bg-emerald-400/5"
          : "border-zinc-700 bg-zinc-900/40"
      }`}
    >
      <p className={compact ? "text-base font-medium" : "text-xl font-medium"}>
        Drop a PrusaSlicer <code className="text-emerald-300">.ini</code> here
      </p>
      {!compact && (
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
          “Export Config” or “Export Config Bundle”. Filament profiles get converted to
          OrcaSlicer <code>.json</code>. Drop several at once if you like.
        </p>
      )}
      <div className="mt-5 flex items-center justify-center gap-3">
        <button
          onClick={() => input.current?.click()}
          className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white"
        >
          Choose file…
        </button>
        <button
          onClick={onSample}
          className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
        >
          Try a sample
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept=".ini,.txt,text/plain"
        multiple
        hidden
        onChange={(e) => pick(e.target.files)}
      />
      {!compact && (
        <p className="mt-5 text-xs text-zinc-500">
          🔒 100% in your browser — your profiles never leave this machine.
        </p>
      )}
    </div>
  );
}

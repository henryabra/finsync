import { useMemo, useState } from "react";
import type { PrinterVariant } from "@finsync/engine";

// A searchable combobox for picking a printer/nozzle variant from the loaded
// bundle. Free typing is still honored (used as a loose filter), so nothing is
// lost if a user's exact variant isn't in the list.
export function VariantPicker({
  variants,
  value,
  onChange,
}: {
  variants: PrinterVariant[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [typing, setTyping] = useState(false);

  // Show the current selection until the user starts typing a search.
  const display = open && typing ? query : value;

  const filtered = useMemo(() => {
    const q = open && typing ? query.toLowerCase().trim() : "";
    const list = q ? variants.filter((v) => v.label.toLowerCase().includes(q)) : variants;
    return list.slice(0, 60);
  }, [variants, query, open, typing]);

  const select = (v: string) => {
    onChange(v);
    setQuery("");
    setTyping(false);
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        value={display}
        placeholder="Pick your printer, or type to search…"
        onFocus={() => {
          setTyping(false);
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setTyping(true);
          onChange(e.target.value);
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && filtered[0]) {
            e.preventDefault();
            select(filtered[0].label);
          }
        }}
        className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500"
      />
      {open && (
        <ul
          // Keep focus so a row's onClick fires before the input blurs.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-zinc-700 bg-zinc-900 shadow-xl"
        >
          <li>
            <button
              onClick={() => select("")}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800"
            >
              <span>All printers</span>
              <span className="text-xs text-zinc-500">everything</span>
            </button>
          </li>
          {filtered.map((v) => (
            <li key={v.label}>
              <button
                onClick={() => select(v.label)}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-zinc-800 ${
                  v.label === value ? "text-emerald-300" : "text-zinc-200"
                }`}
              >
                <span>{v.label}</span>
                <span className="text-xs text-zinc-500">{v.count} profiles</span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-xs text-zinc-500">
              No printer matches “{query}” — your text is still used as a filter.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

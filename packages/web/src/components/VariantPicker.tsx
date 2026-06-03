import { useMemo, useState } from "react";

export interface PickerOption {
  /** What the user sees, e.g. "CORE One L". */
  label: string;
  /** What gets selected, e.g. the printer_model token "COREONEL". */
  value: string;
  count: number;
}

// A searchable combobox. Shows a friendly label, selects an underlying value.
// Free typing still works (used as a loose filter) so nothing is lost.
export function VariantPicker({
  options,
  value,
  onChange,
  placeholder = "Pick your printer, or type to search…",
  allLabel = "All printers",
}: {
  options: PickerOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [typing, setTyping] = useState(false);

  const selectedLabel = value === "" ? allLabel : options.find((o) => o.value === value)?.label ?? value;
  const display = open && typing ? query : selectedLabel;

  const filtered = useMemo(() => {
    const q = open && typing ? query.toLowerCase().trim() : "";
    const list = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
    return list.slice(0, 60);
  }, [options, query, open, typing]);

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
        placeholder={placeholder}
        onFocus={() => {
          setTyping(false);
          setOpen(true);
        }}
        onChange={(e) => {
          // Query is local — only filters the dropdown. The selection is
          // committed only on an explicit pick (value is an exact token, so
          // committing raw keystrokes would filter to nothing).
          setQuery(e.target.value);
          setTyping(true);
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && filtered[0]) {
            e.preventDefault();
            select(filtered[0].value);
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
              <span>{allLabel}</span>
              <span className="text-xs text-zinc-500">everything</span>
            </button>
          </li>
          {filtered.map((o) => (
            <li key={o.value}>
              <button
                onClick={() => select(o.value)}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-zinc-800 ${
                  o.value === value ? "text-emerald-300" : "text-zinc-200"
                }`}
              >
                <span>{o.label}</span>
                <span className="text-xs text-zinc-500">{o.count} profiles</span>
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

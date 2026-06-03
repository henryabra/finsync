import { zipSync, strToU8 } from "fflate";

/** Trigger a browser download of arbitrary data as a file. */
export function downloadBlob(
  filename: string,
  data: BlobPart,
  type = "application/json",
): void {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revoke: revoking synchronously after click() can abort the download
  // in some browsers before it has started.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export interface ZipEntry {
  filename: string;
  content: string;
}

/** Bundle multiple JSON files into a single (stored, uncompressed) .zip download. */
export function downloadZip(
  files: ZipEntry[],
  zipName = "orca-filaments.zip",
): void {
  // Null-proto so filenames like "constructor" can't collide with Object.prototype.
  const entries: Record<string, Uint8Array> = Object.create(null);
  for (const f of files) {
    entries[uniqueName(entries, f.filename)] = strToU8(f.content);
  }
  // level 0 = store only: profiles are tiny and this keeps it dependency-light.
  const zipped = zipSync(entries, { level: 0 });
  downloadBlob(zipName, zipped, "application/zip");
}

/** Pick a name not already in `taken`, inserting `_N` before the extension. */
function uniqueName(taken: Record<string, unknown>, filename: string): string {
  if (!(filename in taken)) return filename;
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot) : "";
  let i = 1;
  let name: string;
  do {
    name = `${base}_${i++}${ext}`;
  } while (name in taken);
  return name;
}

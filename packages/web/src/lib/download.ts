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
  URL.revokeObjectURL(url);
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
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) {
    let name = f.filename;
    let i = 1;
    // De-duplicate identical filenames so no entry is silently dropped.
    while (entries[name]) name = f.filename.replace(/\.json$/i, `_${i++}.json`);
    entries[name] = strToU8(f.content);
  }
  // level 0 = store only: profiles are tiny and this keeps it dependency-light.
  const zipped = zipSync(entries, { level: 0 });
  downloadBlob(zipName, zipped, "application/zip");
}

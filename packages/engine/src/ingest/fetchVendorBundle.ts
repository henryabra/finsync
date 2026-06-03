// Fetches PrusaSlicer's vendor bundle (PrusaResearch.ini) straight from the
// official GitHub repo. This is the source-side mirror of schema-sync: rather
// than make the user find PrusaResearch.ini on disk, pull it over the network.
//
// raw.githubusercontent.com sends `access-control-allow-origin: *`, so this
// works directly in the browser — no backend. `fetch` is a Web API available in
// both the browser and modern Node, so this stays isomorphic (the one helper in
// the engine that touches the network).
//
// Note on freshness: the repo ships the bundle that matches a given PrusaSlicer
// release. A user's locally-installed bundle may be a micro-version newer (their
// app auto-updates profiles), so local upload remains the freshest option.

export interface PrusaVendorRef {
  label: string;
  ref: string; // git ref: a release tag or "master"
}

/** Selectable sources. Pinned tags are proven/reproducible; master is latest. */
export const PRUSA_VENDOR_REFS: readonly PrusaVendorRef[] = [
  { label: "v2.9.5 (stable)", ref: "version_2.9.5" },
  { label: "v2.9.6-beta1", ref: "version_2.9.6-beta1" },
  { label: "v2.9.4", ref: "version_2.9.4" },
  { label: "latest (master)", ref: "master" },
];

/** Default to the matching stable release — proven and reproducible. */
export const DEFAULT_PRUSA_REF = "version_2.9.5";

export function prusaBundleUrl(ref: string = DEFAULT_PRUSA_REF): string {
  return `https://raw.githubusercontent.com/prusa3d/PrusaSlicer/${encodeURIComponent(
    ref,
  )}/resources/profiles/PrusaResearch.ini`;
}

export interface FetchedVendorBundle {
  text: string;
  ref: string;
  url: string;
  /** The bundle's `config_version` (vendor profile version), when present. */
  configVersion?: string;
}

/** Download the PrusaResearch.ini bundle at `ref`. Throws on a non-2xx response. */
export async function fetchPrusaVendorBundle(
  ref: string = DEFAULT_PRUSA_REF,
  signal?: AbortSignal,
): Promise<FetchedVendorBundle> {
  const url = prusaBundleUrl(ref);
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(
      `Could not fetch PrusaResearch.ini @ ${ref} (${res.status} ${res.statusText}).`,
    );
  }
  const text = await res.text();
  const m = text.match(/^\s*config_version\s*=\s*(.+)$/m);
  return { text, ref, url, configVersion: m?.[1]?.trim() };
}

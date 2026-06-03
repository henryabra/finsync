// Persistent cache for the fetched PrusaResearch.ini bundles.
//
// The bundle is ~1.5 MB and rarely changes (a pinned release tag never does), so
// we cache it across reloads instead of re-downloading every visit. The big blob
// lives in the Cache API (async, large-capacity, keyed by URL → one entry per
// ref); a tiny localStorage sidecar holds metadata (config_version, timestamp)
// so the UI can show "cached" without reading the whole blob back.
//
// All storage access is guarded — private-mode / unsupported browsers simply
// fall through to a normal network fetch.

import {
  prusaBundleUrl,
  fetchPrusaVendorBundle,
  type FetchedVendorBundle,
} from "@finsync/engine";

const CACHE_NAME = "finsync-prusa-v1";
const META_KEY = "finsync:prusa:meta";

export interface CachedBundle extends FetchedVendorBundle {
  fromCache: boolean;
  cachedAt: number;
}

export interface CacheMeta {
  configVersion?: string;
  cachedAt: number;
}

type MetaMap = Record<string, CacheMeta>;

function readMeta(): MetaMap {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) ?? "{}") as MetaMap;
  } catch {
    return {};
  }
}

function writeMeta(ref: string, info: CacheMeta): void {
  try {
    const all = readMeta();
    all[ref] = info;
    localStorage.setItem(META_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable — caching is best-effort */
  }
}

/** Synchronous metadata for a ref (drives the "cached" UI hint). */
export function getCacheMeta(ref: string): CacheMeta | null {
  return readMeta()[ref] ?? null;
}

async function openCache(): Promise<Cache | null> {
  try {
    if (typeof caches === "undefined") return null;
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

/**
 * Fetch a Prusa bundle, using the persistent cache. Returns the cached copy when
 * present unless `force` is set (used by a "refresh" action, e.g. for master).
 */
export async function fetchPrusaBundleCached(
  ref: string,
  force = false,
): Promise<CachedBundle> {
  const url = prusaBundleUrl(ref);
  const cache = await openCache();

  if (!force && cache) {
    const hit = await cache.match(url);
    if (hit) {
      const text = await hit.text();
      const meta = getCacheMeta(ref);
      return {
        text,
        ref,
        url,
        configVersion: meta?.configVersion ?? configVersionOf(text),
        fromCache: true,
        cachedAt: meta?.cachedAt ?? 0,
      };
    }
  }

  const fresh = await fetchPrusaVendorBundle(ref);
  const cachedAt = Date.now();
  if (cache) {
    try {
      await cache.put(
        url,
        new Response(fresh.text, {
          headers: { "content-type": "text/plain; charset=utf-8" },
        }),
      );
      writeMeta(ref, { configVersion: fresh.configVersion, cachedAt });
    } catch {
      /* over quota or unavailable — non-fatal */
    }
  }
  return { ...fresh, fromCache: false, cachedAt };
}

/** Forget every cached bundle. */
export async function clearPrusaCache(): Promise<void> {
  try {
    if (typeof caches !== "undefined") await caches.delete(CACHE_NAME);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(META_KEY);
  } catch {
    /* ignore */
  }
}

function configVersionOf(text: string): string | undefined {
  return text.match(/^\s*config_version\s*=\s*(.+)$/m)?.[1]?.trim();
}

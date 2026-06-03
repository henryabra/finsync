// Persisted UI state: the choices worth remembering across reloads — the Prusa
// bundle version, the selected printer, the Orca printer name(s) used for
// `compatible_printers` stamping, and the system filament profiles ticked for
// export. Transient UI (search text, your-profile toggles) is intentionally NOT
// persisted.
//
// Backed by localStorage today. The (de)serialization and source-merging are
// deliberately separated so a URL-anchor backend — for SHARABLE LINKS — is a
// small, additive change later (see the marked seams below); no call site needs
// to change.

import { DEFAULT_PRUSA_REF } from "@finsync/engine";

export interface PersistedState {
  /** Prusa bundle ref chosen in System profiles (also drives the cache auto-load). */
  ref: string;
  /** Selected printer_model token, e.g. "COREONEL" ("" = all printers). */
  printer: string;
  /** Comma-separated Orca printer preset names, stamped onto compatible_printers. */
  orcaPrinters: string;
  /** Names of system filament profiles ticked for export. */
  selectedSystem: string[];
  /** Search text in the export system-profiles list. */
  query: string;
  /** Whether already-in-Orca profiles are revealed in the "all printers" view. */
  showExisting: boolean;
  /** Filenames of your own profiles unticked (excluded) from export. */
  excludedYours: string[];
}

export const DEFAULT_STATE: PersistedState = {
  ref: DEFAULT_PRUSA_REF,
  printer: "",
  orcaPrinters: "",
  selectedSystem: [],
  query: "",
  showExisting: false,
  excludedYours: [],
};

const KEY = "finsync:state:v1";

/**
 * The wire format shared by every persistence backend. A future URL-anchor
 * backend reuses these verbatim — e.g. `btoa(encodeState(s))` into `location.hash`,
 * `decodeState(atob(hash))` on read — so the shape can never drift between
 * localStorage and a shared link.
 */
export function encodeState(state: Partial<PersistedState>): string {
  return JSON.stringify(state);
}

export function decodeState(raw: string | null | undefined): Partial<PersistedState> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Partial<PersistedState>) : {};
  } catch {
    return {};
  }
}

function readLocal(): Partial<PersistedState> {
  try {
    return decodeState(localStorage.getItem(KEY));
  } catch {
    return {};
  }
}

// FUTURE(sharable-links): read a shared state blob from the URL anchor.
//   function readAnchor(): Partial<PersistedState> {
//     return decodeState(safeAtob(location.hash.replace(/^#s=/, "")));
//   }

/**
 * Load persisted state, merged over defaults. Sources are spread in priority
 * order (later wins). To add sharable links, spread `readAnchor()` LAST so a
 * shared link overrides the visitor's local storage:
 *
 *   return { ...DEFAULT_STATE, ...readLocal(), ...readAnchor() };
 */
export function loadState(): PersistedState {
  return { ...DEFAULT_STATE, ...readLocal() };
}

/** Persist the full state. Best-effort — unavailable storage is a no-op. */
export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(KEY, encodeState(state));
  } catch {
    /* storage unavailable (private mode / quota) — persistence is best-effort */
  }
  // FUTURE(sharable-links): also reflect `state` into the URL anchor here, e.g.
  //   history.replaceState(null, "", `#s=${btoa(encodeState(state))}`);
}

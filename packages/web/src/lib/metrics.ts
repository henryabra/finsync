/// <reference types="vite/client" />

// Privacy-friendly, cookieless usage + error metrics for the static web app.
//
// We bundle NO vendor SDK. An analytics <script> is injected at runtime ONLY
// when configured via env vars, and events are dispatched through whichever
// privacy-friendly provider's global the script exposes — Umami, Plausible, or
// GoatCounter (all cookieless, all with a free or self-hostable tier). Swap
// providers by changing the env vars below; no code change required.
//
//   VITE_ANALYTICS_SRC         script URL (e.g. https://cloud.umami.is/script.js)
//   VITE_ANALYTICS_WEBSITE_ID  site/website id the provider issued (Umami)
//   VITE_ANALYTICS_DOMAIN      registered domain (Plausible)
//
// With no VITE_ANALYTICS_SRC (local dev, or a fork that hasn't opted in) every
// call is a no-op and nothing leaves the browser. Do Not Track is honoured. We
// only ever send event names + tiny enum/count props — never file names,
// profile contents, or any other PII.

type Props = Record<string, string | number | boolean>;

interface ProviderGlobals {
  umami?: { track(event: string, props?: Props): void };
  plausible?: (event: string, opts?: { props: Props }) => void;
  goatcounter?: { count(opts: { path: string; event: boolean }): void };
}

const SRC = import.meta.env.VITE_ANALYTICS_SRC as string | undefined;
const WEBSITE_ID = import.meta.env.VITE_ANALYTICS_WEBSITE_ID as string | undefined;
const DOMAIN = import.meta.env.VITE_ANALYTICS_DOMAIN as string | undefined;

function doNotTrack(): boolean {
  const nav = navigator as Navigator & { msDoNotTrack?: string };
  const dnt = nav.doNotTrack ?? (window as { doNotTrack?: string }).doNotTrack ?? nav.msDoNotTrack;
  return dnt === "1" || dnt === "yes";
}

const enabled = Boolean(SRC) && !doNotTrack();
let started = false;

/** Inject the analytics script (once). Safe to call when unconfigured — no-ops. */
export function initMetrics(): void {
  if (!enabled || started) return;
  started = true;
  const s = document.createElement("script");
  s.src = SRC!;
  s.defer = true;
  // Each provider reads only its own attribute; setting all is harmless.
  if (WEBSITE_ID) s.dataset.websiteId = WEBSITE_ID; // Umami
  if (DOMAIN) s.dataset.domain = DOMAIN; // Plausible
  document.head.appendChild(s);
}

/**
 * Record a custom event. Props must be small enums/counts — never PII. Drops
 * silently if the provider script hasn't loaded yet (our events all fire after
 * user interaction, by which point it has), and never throws into the app.
 */
export function track(event: string, props?: Props): void {
  if (!enabled) return;
  const w = window as unknown as ProviderGlobals;
  try {
    if (typeof w.umami?.track === "function") w.umami.track(event, props);
    else if (typeof w.plausible === "function") w.plausible(event, props ? { props } : undefined);
    else if (typeof w.goatcounter?.count === "function") w.goatcounter.count({ path: event, event: true });
  } catch {
    /* metrics must never break the app */
  }
}

/** Report an error as a metric. `where` is a fixed call-site tag, not user data. */
export function trackError(where: string, err: unknown): void {
  // Truncate and keep only the message — no stack, no user content.
  const message = (err instanceof Error ? err.message : String(err)).slice(0, 200);
  track("error", { where, message });
}

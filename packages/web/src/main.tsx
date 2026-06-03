import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { initMetrics, trackError } from "./lib/metrics.ts";
import "./index.css";

initMetrics();
// Surface otherwise-silent runtime failures as error metrics (no-op unless
// analytics is configured). Passive listeners — they never swallow the error.
window.addEventListener("error", (e) => trackError("window.onerror", e.error ?? e.message));
window.addEventListener("unhandledrejection", (e) => trackError("unhandledrejection", e.reason));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

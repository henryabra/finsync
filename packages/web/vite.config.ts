import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const engineSrc = fileURLToPath(new URL("../engine/src/index.ts", import.meta.url));

// The engine is pure isomorphic TS. We alias it straight to its source so Vite
// transpiles it as first-class app code (no build step) — Vite resolves the
// engine's NodeNext-style ".js" import specifiers to their ".ts" sources.
export default defineConfig(({ command }) => ({
  // GitHub Pages serves project sites from /<repo>/, so production asset URLs
  // need that base prefix. The dev server stays at root.
  base: command === "build" ? "/finsync/" : "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@finsync/engine": engineSrc,
    },
  },
  server: {
    // Allow importing the engine source + test fixtures from sibling packages.
    fs: { allow: [repoRoot] },
  },
}));

/**
 * @file Vitest configuration.
 * @description Tests live in `tests/` and mirror `src/`; they run in jsdom with Testing Library.
 */

import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setupTests.tsx"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    // next-intl imports "next/server" without an extension, which only Vite's resolver understands
    server: { deps: { inline: ["next-intl"] } },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/client/**"],
      // `npm run coverage` (and CI) fails if any line, branch, function or statement of src/ is not covered
      thresholds: { 100: true },
    },
  },
})

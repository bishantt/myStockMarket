import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

/**
 * Vitest — the app's unit and component test runner (plan §6.1).
 *
 * Scope note: these are the *unit* tests, colocated with the code as `*.test.ts(x)`. Browser
 * journeys, accessibility scans, visual regression, and the PWA assertions all live in
 * Playwright under `e2e/` instead, so Vitest is told explicitly to ignore that directory.
 * Without that exclusion Vitest tries to collect Playwright's specs and fails confusingly.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom, because the mandatory suites in §6.1 render components (the BaseRate renderer,
    // the copy deck, the tier cap) rather than exercising the browser.
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
  },
  resolve: {
    // Mirrors the "@/*" import alias from tsconfig.json so tests and app code agree.
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});

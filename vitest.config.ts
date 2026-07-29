import { defineConfig } from "vitest/config";

// Pure logic only (recurrence expansion, streak computation) — no component
// testing infra set up yet, mirrors the same scoping decision made in
// Pixelpanic's vitest.config.ts.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});

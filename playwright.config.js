import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // node --test owns *.test.js (unit); Playwright owns *.spec.js (E2E).
  testMatch: "**/*.spec.js",
  // Playwright spins up the static server for the suite (reuses one already running).
  webServer: {
    command: "python3 -m http.server 8137 --directory dist",
    url: "http://localhost:8137/index.html",
    reuseExistingServer: true,
    timeout: 15000
  },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:8137",
    viewport: { width: 1600, height: 900 }
  },
  reporter: [["list"]]
});
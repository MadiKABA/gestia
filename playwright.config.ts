import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    // /manifest.json plutôt que "/" : le proxy redirige "/" vers /login (pas
    // encore de page, cf. cahier des charges — auth UI hors scope de ce
    // scaffolding), ce que le check de disponibilité de Playwright suit et
    // interprète comme "pas prêt" indéfiniment.
    url: "http://localhost:3000/manifest.json",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

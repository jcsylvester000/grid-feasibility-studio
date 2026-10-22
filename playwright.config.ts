import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    // Optional: use a pre-installed Chromium (CI sandboxes). Unset on your computer.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], browserName: "chromium" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npx next start -p ${port}`,
    port,
    reuseExistingServer: false,
    timeout: 120_000,
    // End-to-end runs use an in-memory Postgres (PGlite) and the mock VectorShift: no network, no Neon.
    env: {
      DB_DRIVER: "pglite",
      ALLOW_PGLITE: "true",
      PGLITE_SEED_ADMIN: "e2e_admin:admin pass phrase for tests",
      APP_SECRET: "e2e-secret-e2e-secret-e2e-secret-0001",
      APP_ORIGIN: `http://localhost:${port}`,
      VECTORSHIFT_BASE_URL: "http://localhost:4010",
    },
  },
});

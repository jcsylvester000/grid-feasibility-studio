import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);
const teaserPort = port + 1;
const livePort = port + 2;

/** One app server: in-memory Postgres (PGlite), the mock VectorShift and local file storage. No network. */
const app = (p: number, extra: Record<string, string>) => ({
  command: `npx next start -p ${p}`,
  port: p,
  reuseExistingServer: false,
  timeout: 120_000,
  env: {
    DB_DRIVER: "pglite",
    ALLOW_PGLITE: "true",
    PGLITE_SEED_ADMIN: "e2e_admin:admin pass phrase for tests",
    APP_SECRET: "e2e-secret-e2e-secret-e2e-secret-0001",
    APP_ORIGIN: `http://localhost:${p}`,
    VECTORSHIFT_BASE_URL: "http://localhost:4010",
    VS_PIPELINE_QUICK_REPORT: "mock-quick_report",
    VS_PIPELINE_EXECUTIVE_SUMMARY: "mock-executive_summary",
    VS_PIPELINE_FEASIBILITY_REPORT: "mock-feasibility_report",
    VS_PIPELINE_TEASER_INTAKE: "mock-teaser_intake",
    RUN_DISPATCH: "inline",
    // Most suites check the BRD contract output; the b12 suite runs the live Quick Report format.
    VS_INPUT_QUICK_REPORT: "run_request",
    VS_MAX_CONCURRENT: "50",
    DESIGN_SAMPLES: "true",
    UPLOAD_DRIVER: "local",
    UPLOAD_LOCAL_DIR: `.data/e2e-uploads-${p}`,
    ...extra,
  },
});

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
    { name: "mobile", testIgnore: /b7-|b12-/, use: { ...devices["Pixel 7"], browserName: "chromium" } },
    {
      name: "desktop",
      testIgnore: /b7-|b12-/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    // Teaser Scan is behind FEATURE_TEASER_SCAN: a second server with the flag on (release 1b).
    {
      name: "teaser-mobile",
      testMatch: /b7-/,
      use: { ...devices["Pixel 7"], browserName: "chromium", baseURL: `http://localhost:${teaserPort}` },
    },
    {
      name: "teaser-desktop",
      testMatch: /b7-/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        baseURL: `http://localhost:${teaserPort}`,
      },
    },
    // Live Quick Report format (named inputs, pipeline output format) and report versions.
    { name: "live-desktop", testMatch: /b12-/, use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, baseURL: `http://localhost:${livePort}` } },
    { name: "live-mobile", testMatch: /b12-/, use: { ...devices["Pixel 7"], browserName: "chromium", baseURL: `http://localhost:${livePort}` } },
  ],
  webServer: [
    {
      command: "npx tsx mock/vectorshift/server.ts",
      port: 4010,
      reuseExistingServer: false,
      env: { MOCK_VS_PORT: "4010", MOCK_VS_DELAY_MS: "1500", MOCK_VS_PAYLOADS: "golden" },
    },
    app(port, {}),
    app(teaserPort, { FEATURE_TEASER_SCAN: "true", DEMO_MODE: "true" }),
    app(livePort, { VS_INPUT_QUICK_REPORT: "fields" }),
  ],
});

import { defineConfig, devices } from "@playwright/test";

declare const process: { env: Record<string, string | undefined> };

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseUrl ?? "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "line",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "npm run dev -- --port 4173",
        url: baseURL,
        reuseExistingServer: true,
      },
});

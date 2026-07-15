import { defineConfig } from "@playwright/test";

const viewports = {
  desktop: { width: 1536, height: 1024 },
  tablet: { width: 1024, height: 768 },
  mobile: { width: 390, height: 844 },
} as const;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    timezoneId: "Asia/Bangkok"
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI
  },
  projects: [
    ...(["chromium", "firefox", "webkit"] as const).flatMap((browserName) =>
      (Object.entries(viewports) as [keyof typeof viewports, { width: number; height: number }][]).map(
        ([size, viewport]) => ({
          name: `${browserName}-${size}`,
          use: { browserName, viewport },
        }),
      ),
    ),
  ]
});

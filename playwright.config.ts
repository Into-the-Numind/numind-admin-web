import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for admin-web E2E.
 *
 * Point BASE_URL at the running admin-web you want to hit:
 *   dev:   http://49.233.219.254:9100
 *   local: http://localhost:5174 (with `npm run dev` in another terminal)
 *
 * Admin login creds come from env:
 *   E2E_USERNAME, E2E_PASSWORD (dev账号有 is_admin=true，与 v3 C 端共用)
 */
export default defineConfig({
  testDir: "./e2e",
  // Sequential runs so stateful admin operations (edit → save → reload)
  // don't race against each other.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30 * 1000,
  expect: { timeout: 5 * 1000 },
  use: {
    baseURL: process.env.BASE_URL || "http://49.233.219.254:9100",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "auth-setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      dependencies: ["auth-setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/admin.json",
      },
    },
  ],
});

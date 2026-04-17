import { test as setup, expect } from "@playwright/test";

const authFile = "e2e/.auth/admin.json";

/**
 * Logs in as admin once at the start of a test run and saves the auth state
 * (localStorage token + cookies) to `.auth/admin.json`. All dependent tests
 * reuse that state via storageState in the config, avoiding repeated logins.
 *
 * Credentials come from env. For dev, set:
 *   export E2E_USERNAME=admin
 *   export E2E_PASSWORD=...
 */
setup("authenticate admin", async ({ page }) => {
  const username = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;
  if (!username || !password) {
    throw new Error(
      "E2E_USERNAME / E2E_PASSWORD env vars are required for auth setup",
    );
  }

  await page.goto("/login");

  // Form structure: two inputs, one submit button. Use labels / placeholders
  // rather than CSS classes so the selector survives visual refactors.
  await page.getByPlaceholder(/用户名|账号|username/i).fill(username);
  await page.getByPlaceholder(/密码|password/i).fill(password);
  await page.getByRole("button", { name: /登录|sign\s*in/i }).click();

  // Successful login redirects off /login.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 10_000,
  });

  // Verify auth store has a token in localStorage.
  const token = await page.evaluate(() => localStorage.getItem("admin_token"));
  expect(token).toBeTruthy();

  await page.context().storageState({ path: authFile });
});

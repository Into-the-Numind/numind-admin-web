import { test, expect } from "@playwright/test";

/**
 * Agent E2E: history restore flow
 *
 * Critical path: list → click [详情] on first agent → switch to [历史版本] tab →
 *   if ≥ 2 versions exist, click first [恢复] button → ConfirmModal appears →
 *   confirm → history list refreshes → newest entry's changes_summary reads
 *   "从 v{N} 恢复".
 *
 * Dev-env dependencies:
 *   - At least 1 existing agent (otherwise self-skip)
 *   - That agent must have ≥ 2 history versions (otherwise self-skip)
 */

test.describe("Agent: history restore flow", () => {
  test("user can restore an older version", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForLoadState("networkidle");

    // Need at least one agent with a [详情] button
    const detailButtons = page.getByRole("button", { name: /^详情$/ });
    const detailCount = await detailButtons.count();
    if (detailCount === 0) {
      test.skip(
        true,
        "Need at least 1 existing agent in dev env for history restore test",
      );
      return;
    }

    // Navigate to the first agent's detail page
    await detailButtons.first().click();
    await expect(page).toHaveURL(/\/agents\/\d+$/, { timeout: 10_000 });

    // Switch to 历史版本 tab
    await page.getByRole("tab", { name: /历史版本/ }).click();
    await page.waitForLoadState("networkidle");

    // Need at least 2 versions to perform a restore (current version has no [恢复])
    const restoreButtons = page.getByRole("button", { name: /^恢复$/ });
    const restoreCount = await restoreButtons.count();
    if (restoreCount === 0) {
      test.skip(
        true,
        "Agent has only 1 version; need ≥ 2 versions to test restore",
      );
      return;
    }

    // Click the first available [恢复] button (oldest restorable version)
    await restoreButtons.first().click();

    // ConfirmModal should appear asking to confirm the restore
    await expect(page.getByText(/确认恢复|恢复将创建/)).toBeVisible({
      timeout: 5_000,
    });

    // Confirm the restore action
    await page
      .getByRole("button", { name: /确认|确定/ })
      .last()
      .click();

    // Wait for the restore to complete and the history list to refresh
    await page.waitForLoadState("networkidle");

    // The newest history entry should display "从 v{N} 恢复" as changes_summary
    await expect(page.getByText(/从 v\d+ 恢复/)).toBeVisible({
      timeout: 10_000,
    });
  });
});

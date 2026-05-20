import { test, expect } from "@playwright/test";

/**
 * Agent E2E: template-derive flow
 *
 * Critical path: list → [从模板库] → select first template → tweak name →
 *   save → afterSave Modal → [暂时跳过] → detail page → history tab shows v1.
 *
 * Dev-env dependency: at least 1 built-in template must exist.
 * If none, the test self-skips with a clear message.
 */

test.describe("Agent: template derive flow", () => {
  test("user can derive a new agent from a built-in template", async ({
    page,
  }) => {
    await page.goto("/agents");

    // Wait for list to settle (loading skeleton or list/empty state visible)
    await page.waitForLoadState("networkidle");

    // Click [从模板库选] — opens /agents/new/from-template
    await page
      .getByRole("button", { name: /从模板库|选择模板/ })
      .first()
      .click();

    // Should navigate to template gallery
    await expect(page).toHaveURL(/\/agents\/new\/from-template/, {
      timeout: 10_000,
    });

    // Wait for templates to load
    await page.waitForLoadState("networkidle");

    // If no templates exist in dev env, skip gracefully
    const useTemplateButtons = page.getByRole("button", {
      name: /用这个模板/,
    });
    const count = await useTemplateButtons.count();
    if (count === 0) {
      test.skip(
        true,
        "No templates available in this dev env to test derive flow",
      );
      return;
    }

    // Click the first template's [用这个模板] button
    await useTemplateButtons.first().click();

    // Builder opens, URL should reflect from=template or similar
    await expect(page).toHaveURL(/\/agents\/builder/, { timeout: 10_000 });

    // Tweak the agent name to make this run uniquely identifiable
    const uniqueName = `e2e模板派生-${Date.now()}`;
    const nameInput = page.locator('[data-question="name"] input').first();
    await nameInput.fill(uniqueName);

    // Click [保存]
    await page.getByRole("button", { name: /^保存$/ }).click();

    // AfterSaveModal should appear
    await expect(page.getByText(/已发布|要先体验/)).toBeVisible({
      timeout: 10_000,
    });

    // Skip preview → go to detail page
    await page.getByRole("button", { name: /暂时跳过/ }).click();

    // Should land on /agents/:id (detail page)
    await expect(page).toHaveURL(/\/agents\/\d+$/, { timeout: 10_000 });

    // New agent name should be visible in heading
    await expect(page.getByRole("heading", { name: uniqueName })).toBeVisible({
      timeout: 5_000,
    });

    // Switch to history tab → first save creates v1 "首次发布"
    await page.getByRole("tab", { name: /历史版本/ }).click();
    await expect(page.getByText(/首次发布/)).toBeVisible({ timeout: 10_000 });
  });
});

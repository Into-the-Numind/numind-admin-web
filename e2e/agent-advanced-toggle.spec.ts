import { test, expect } from "@playwright/test";

/**
 * Agent E2E: advanced-mode toggle flow
 *
 * Critical path: list → click [编辑] on first agent (problem-mode) →
 *   Builder renders → click [切换到高级模式] link → ConfirmModal warns →
 *   confirm → Builder switches to AdvancedEdit view (NoticeBanner + textarea).
 *
 * Dev-env dependency: at least 1 existing agent (any mode).
 * If none, the test self-skips.
 */

test.describe("Agent: advanced mode toggle flow", () => {
  test("user can toggle a problem-mode agent to advanced mode", async ({
    page,
  }) => {
    await page.goto("/agents");
    await page.waitForLoadState("networkidle");

    // Need at least one agent with an [编辑] button
    const editButtons = page.getByRole("button", { name: /^编辑$/ });
    const count = await editButtons.count();
    if (count === 0) {
      test.skip(
        true,
        "Need at least 1 existing agent for advanced toggle test",
      );
      return;
    }

    // Click the first row's [编辑] button → goes to /agents/:id/edit
    await editButtons.first().click();

    await expect(page).toHaveURL(/\/agents\/\d+\/edit/, { timeout: 10_000 });

    // Builder should render; click the [切换到高级模式] link
    await page.getByText(/切换到高级模式/).click();

    // AdvancedToggleConfirmModal should appear with an irreversibility warning
    await expect(
      page.getByText(/无法切回问卷模式|无法切回|不可逆/),
    ).toBeVisible({ timeout: 5_000 });

    // Click the confirm button inside the modal (last match avoids nav link)
    await page
      .getByRole("button", { name: /切换到高级模式/ })
      .last()
      .click();

    // After confirmation the Builder switches to AdvancedEdit view.
    // The NoticeBanner specific to advanced mode should appear.
    await expect(
      page.getByText(/自定义 Prompt 编辑功能即将上线|高级模式/),
    ).toBeVisible({ timeout: 10_000 });

    // The body textarea (Markdown editor / read-only placeholder) should be visible
    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 5_000 });
  });
});

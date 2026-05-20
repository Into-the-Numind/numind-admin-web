import { test, expect } from "@playwright/test";

/**
 * Agent E2E: scratch-create flow
 *
 * Critical path: list → [+ 创建 Agent] → [从零创建] → attempt save (validation
 *   errors appear) → fill required fields (name / description / welcome_message /
 *   q6 / q7) → save → AfterSaveModal → skip → new agent appears on list.
 */

test.describe("Agent: scratch-create flow", () => {
  test("user can create an agent from scratch with validation feedback", async ({
    page,
  }) => {
    await page.goto("/agents");
    await page.waitForLoadState("networkidle");

    // Click the create button — may be labelled "+ 创建 Agent" or just "创建"
    await page
      .getByRole("button", { name: /\+ 创建 Agent|创建/ })
      .first()
      .click();

    // Should be on /agents/new (create-choose page)
    await expect(page).toHaveURL(/\/agents\/new$/, { timeout: 10_000 });

    // Click [从零创建] card to enter the Builder with from=scratch
    await page.getByText(/从零创建/).click();

    // Builder renders at /agents/builder?from=scratch (or similar)
    await expect(page).toHaveURL(/\/agents\/builder/, { timeout: 10_000 });

    // Attempt to save without filling anything → validation errors should show
    await page.getByRole("button", { name: /^保存$/ }).click();

    // At least one validation error message must be visible
    await expect(
      page.getByText(/请输入助手名字|请输入描述|请输入欢迎语/).first(),
    ).toBeVisible({ timeout: 5_000 });

    // ── Fill required fields ──────────────────────────────────────────────────

    const uniqueName = `e2e从零-${Date.now()}`;

    // Q1: agent name
    await page.locator('[data-question="name"] input').first().fill(uniqueName);

    // Q2: description
    await page
      .locator('[data-question="description"] input')
      .first()
      .fill("这是一个 e2e 测试创建的助手，仅用于自动化验证");

    // Q3: welcome_message
    await page
      .locator('[data-question="welcome_message"] textarea')
      .first()
      .fill("你好，我是 e2e 测试助手，不会被真实使用");

    // Q6: task type — check the first checkbox option
    await page
      .locator('[data-question="q6"] input[type="checkbox"]')
      .first()
      .check();

    // Q7: material type — check the first checkbox option
    await page
      .locator('[data-question="q7"] input[type="checkbox"]')
      .first()
      .check();

    // Q9 and Q12 have sensible defaults; remaining questions are optional or
    // pre-filled — click save now
    await page.getByRole("button", { name: /^保存$/ }).click();

    // AfterSaveModal appears after successful save
    await expect(page.getByText(/已发布|要先体验/)).toBeVisible({
      timeout: 10_000,
    });

    // Skip the preview modal
    await page.getByRole("button", { name: /暂时跳过/ }).click();

    // Verify the new agent appears on the list page
    await page.goto("/agents");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 10_000 });
  });
});

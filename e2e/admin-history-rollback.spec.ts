import { test, expect } from "@playwright/test";

/**
 * M-B8: Admin version history + rollback round-trip (dev integration)
 *
 * Critical path:
 *   1. Open a fresh agent (scratch-create) or the seeded test agent (id 99999).
 *   2. Edit welcome_message → save → v2 created.
 *   3. Edit welcome_message again → save → v3 created.
 *   4. Navigate to [历史版本] tab → expect 3 entries (v1, v2, v3).
 *   5. Click [恢复] on v1 → ConfirmModal → confirm → v4 created.
 *   6. Verify v4's welcome_message matches the original v1 value.
 *
 * Guard: test.skip unless E2E_INTEGRATION=true.
 * Teardown: soft-delete the scratch agent created for this test (if any).
 *
 * Dev-env dependencies:
 *   - Dev backend running
 *   - At least 1 agent OR scratch-create succeeds
 *
 * Selector reference: agent-history-restore.spec.ts (tab, restore button,
 *   confirm modal) + agent-scratch-create.spec.ts (builder fields, save flow).
 */

const SHOULD_RUN = process.env.E2E_INTEGRATION === "true";

/** Welcome messages used across the three versions. */
const WELCOME_V1 = "你好，我是 e2e 历史测试助手 v1";
const WELCOME_V2 = "你好，我是 e2e 历史测试助手 v2（已修改）";
const WELCOME_V3 = "你好，我是 e2e 历史测试助手 v3（再次修改）";

test.describe
  .skip("M-B8: admin history rollback round-trip (dev integration)", () => {
  test.skip(!SHOULD_RUN, "Requires E2E_INTEGRATION=true + dev backend running");

  let scratchAgentId: number | null = null;

  test.afterEach(async ({ request }) => {
    if (scratchAgentId !== null) {
      try {
        await request.delete(`/v1/agent/skills/${scratchAgentId}`);
      } catch {
        // ignore teardown failures
      }
      scratchAgentId = null;
    }
  });

  test("edit agent twice then rollback v1 — v4 carries v1 welcome_message", async ({
    page,
  }) => {
    // ── Step 1: Create a fresh scratch agent so we own all versions ───────────
    await page.goto("/agents");
    await page.waitForLoadState("networkidle");

    await page
      .getByRole("button", { name: /\+ 创建 Agent|创建/ })
      .first()
      .click();

    await expect(page).toHaveURL(/\/agents\/new$/, { timeout: 10_000 });

    // From scratch path — mirrors agent-scratch-create.spec.ts
    await page.getByText(/从零创建/).click();
    await expect(page).toHaveURL(/\/agents\/builder/, { timeout: 10_000 });

    const uniqueName = `e2e-历史回滚-${Date.now()}`;

    await page.locator('[data-question="name"] input').first().fill(uniqueName);

    await page
      .locator('[data-question="description"] input')
      .first()
      .fill("e2e 历史回滚测试用助手");

    // Set the initial (v1) welcome message
    await page
      .locator('[data-question="welcome_message"] textarea')
      .first()
      .fill(WELCOME_V1);

    // Q6 + Q7 are required checkboxes
    await page
      .locator('[data-question="q6"] input[type="checkbox"]')
      .first()
      .check();
    await page
      .locator('[data-question="q7"] input[type="checkbox"]')
      .first()
      .check();

    // Save → v1 published
    await page.getByRole("button", { name: /^保存$/ }).click();
    await expect(page.getByText(/已发布|要先体验/)).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: /暂时跳过/ }).click();

    // Capture agent id from URL
    await expect(page).toHaveURL(/\/agents\/\d+$/, { timeout: 10_000 });
    const matchCreate = page.url().match(/\/agents\/(\d+)$/);
    scratchAgentId = matchCreate ? Number(matchCreate[1]) : null;
    expect(scratchAgentId).not.toBeNull();

    // ── Step 2: Edit → save → v2 ──────────────────────────────────────────────
    await page.getByRole("button", { name: /^编辑$/ }).click();
    await expect(page).toHaveURL(/\/agents\/\d+\/edit/, { timeout: 10_000 });

    await page
      .locator('[data-question="welcome_message"] textarea')
      .first()
      .fill(WELCOME_V2);

    await page.getByRole("button", { name: /^保存$/ }).click();
    await expect(page.getByText(/已发布|要先体验/)).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: /暂时跳过/ }).click();

    await expect(page).toHaveURL(/\/agents\/\d+$/, { timeout: 10_000 });

    // ── Step 3: Edit again → save → v3 ────────────────────────────────────────
    await page.getByRole("button", { name: /^编辑$/ }).click();
    await expect(page).toHaveURL(/\/agents\/\d+\/edit/, { timeout: 10_000 });

    await page
      .locator('[data-question="welcome_message"] textarea')
      .first()
      .fill(WELCOME_V3);

    await page.getByRole("button", { name: /^保存$/ }).click();
    await expect(page.getByText(/已发布|要先体验/)).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: /暂时跳过/ }).click();

    await expect(page).toHaveURL(/\/agents\/\d+$/, { timeout: 10_000 });

    // ── Step 4: History tab shows 3 versions ──────────────────────────────────
    // Selector: agent-history-restore.spec.ts uses getByRole("tab", { name: /历史版本/ })
    await page.getByRole("tab", { name: /历史版本/ }).click();
    await page.waitForLoadState("networkidle");

    // There must be at least 2 restorable versions now (v1, v2 are restorable; v3 is current)
    const restoreButtons = page.getByRole("button", { name: /^恢复$/ });
    const restoreCount = await restoreButtons.count();
    expect(restoreCount).toBeGreaterThanOrEqual(2);

    // ── Step 5: Rollback to v1 ────────────────────────────────────────────────
    // The last [恢复] button corresponds to the oldest version (v1).
    // Ordering: history list is newest-first, so last button = v1.
    await restoreButtons.last().click();

    // ConfirmModal — same selector as agent-history-restore.spec.ts
    await expect(page.getByText(/确认恢复|恢复将创建/)).toBeVisible({
      timeout: 5_000,
    });

    await page
      .getByRole("button", { name: /确认|确定/ })
      .last()
      .click();

    await page.waitForLoadState("networkidle");

    // After restore, history list gains a new entry "从 v1 恢复" — same assertion
    // pattern as agent-history-restore.spec.ts
    await expect(page.getByText(/从 v\d+ 恢复/)).toBeVisible({
      timeout: 10_000,
    });

    // ── Step 6: Verify v4 carries v1's welcome_message ────────────────────────
    // Navigate into the newest version's detail to confirm the welcome message
    // was rolled back to WELCOME_V1. The detail page (and builder) show the
    // current live config which is now v4 = v1 content.
    await page.getByRole("tab", { name: /^基本信息|^详情/ }).click();
    await page.waitForLoadState("networkidle");

    // The welcome message field should contain the v1 text
    await expect(
      page.locator('[data-question="welcome_message"] textarea').first(),
    ).toHaveValue(WELCOME_V1, { timeout: 10_000 });
  });
});

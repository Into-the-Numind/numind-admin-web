/**
 * Context Budget Compression — Admin E2E Spec Skeleton
 *
 * NDF S5 Playwright spec for the 4 high-risk admin paths.
 * All tests are marked test.fixme() until a running dev server + admin login
 * is available; this allows the file to compile and be discovered by CI without
 * actually executing against a live server.
 *
 * To enable during S5:
 *   1. Start a dev or staging admin-web server
 *   2. Set BASE_URL, E2E_USERNAME, E2E_PASSWORD
 *   3. Remove the test.fixme() wrappers (or pass --grep context-budget)
 */
import { test, expect } from "@playwright/test";

test.describe("Context Budget — Admin Paths", () => {
  // ---------------------------------------------------------------------------
  // Path 1: Admin rejects LLM service with invalid context_window
  //
  // Spec §7.0: when creating/editing an AI service provider route, the admin
  // UI must validate that context_window + max_output_tokens are non-zero and
  // consistent. An invalid submission must be rejected client-side with a
  // visible validation error before reaching the API.
  // ---------------------------------------------------------------------------
  test.fixme("admin can reject invalid LLM service capability", // S5: requires running dev server + admin login
  async ({ page }) => {
    await page.goto("/ai-services");

    // Click "新建服务" or equivalent create button
    await page.getByRole("button", { name: /新建|添加|Create/i }).click();

    // Fill in the form but leave context_window as 0 / blank
    await page
      .getByLabel(/服务名称|Service Name/i)
      .fill("test-invalid-context");
    await page.getByLabel(/context.window/i).fill("0");
    await page.getByLabel(/max.output.tokens/i).fill("0");

    // Submit — should NOT call the API
    await page.getByRole("button", { name: /确认|保存|Submit|Save/i }).click();

    // Expect a validation error to appear in the UI
    await expect(
      page.getByText(/context.window.*必须|must be greater/i),
    ).toBeVisible();

    // Confirm the modal / form is still open (not navigated away)
    await expect(page.getByLabel(/context.window/i)).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Path 2: Admin creates a new token profile version
  //
  // Spec §7.1: POST /v1/admin/context-budget/token-profiles creates a new
  // profile version. After creation the list should show the new version and
  // the previous active version should be deactivated (is_active=false).
  // ---------------------------------------------------------------------------
  test.fixme("admin can create new token profile version", // S5: requires running dev server + admin login
  async ({ page }) => {
    await page.goto("/context-budget");

    // Navigate to Token Profiles tab
    await page.getByRole("tab", { name: /Token Profile|估算配置/i }).click();

    // Count current rows
    const rows = page.locator("table tbody tr");
    const countBefore = await rows.count();

    // Click create / new version button
    await page
      .getByRole("button", { name: /新建版本|Create Version|New Profile/i })
      .click();

    // Fill in the form with valid data
    await page.getByLabel(/chars.per.token|字符比例/i).fill("3");
    await page.getByLabel(/boost|系数/i).fill("1.3");
    await page.getByRole("button", { name: /确认|保存|Submit|Save/i }).click();

    // Row count should increment by 1
    await expect(rows).toHaveCount(countBefore + 1);

    // New profile row should be marked active
    const newRow = rows.last();
    await expect(newRow.getByText(/active|激活/i)).toBeVisible();

    // Previous active row should now show inactive
    if (countBefore > 0) {
      const prevRow = rows.nth(countBefore - 1);
      await expect(prevRow.getByText(/inactive|已停用/i)).toBeVisible();
    }
  });

  // ---------------------------------------------------------------------------
  // Path 3: Admin edits policy and sees updated safe budget
  //
  // Spec §7.2: PUT /v1/admin/context-budget/policies/:id updates a policy.
  // The Preview tab should reflect the new safe_input_budget immediately when
  // the policy is saved and the preview is re-run for the same service/model.
  // ---------------------------------------------------------------------------
  test.fixme("admin can edit policy and see updated safe budget", // S5: requires running dev server + admin login
  async ({ page }) => {
    await page.goto("/context-budget");

    // Navigate to Policies tab
    await page.getByRole("tab", { name: /Policy|压缩策略|Policies/i }).click();

    // Pick the first policy row and click edit
    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toBeVisible();
    await firstRow.getByRole("button", { name: /编辑|Edit/i }).click();

    // Change safe_ratio to something slightly smaller
    const safeRatioInput = page.getByLabel(/safe.ratio|安全比例/i);
    const originalValue = await safeRatioInput.inputValue();
    const newValue = String(Math.max(0.1, parseFloat(originalValue) - 0.05));
    await safeRatioInput.fill(newValue);
    await page.getByRole("button", { name: /确认|保存|Submit|Save/i }).click();

    // Navigate to Preview tab and trigger a preview
    await page.getByRole("tab", { name: /Preview|预览/i }).click();

    // Select a service and run preview
    const serviceSelect = page.getByLabel(/服务|Service/i).first();
    await serviceSelect.click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: /预览|Preview|计算/i }).click();

    // Safe budget result should be visible and non-zero
    const budgetResult = page.getByTestId("safe-input-budget");
    await expect(budgetResult).toBeVisible();
    const budgetText = await budgetResult.textContent();
    expect(Number(budgetText?.replace(/,/g, ""))).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // Path 4: Admin views recent events without prompt content
  //
  // Spec §11 (privacy): GET /v1/admin/context-budget/events returns event
  // metadata only. The response MUST NOT contain the original prompt text,
  // fragment content, or any PII from the user's input.
  // ---------------------------------------------------------------------------
  test.fixme("admin can view recent events without prompt content", // S5: requires running dev server + admin login
  async ({ page }) => {
    await page.goto("/context-budget");

    // Navigate to Recent Events tab
    await page.getByRole("tab", { name: /Events|最近事件|历史记录/i }).click();

    // Wait for the table to render (may be empty on fresh dev env — that's OK)
    await page.waitForSelector("table", { timeout: 5000 }).catch(() => {
      // If no table, check for an empty state message
    });

    // Verify column headers — should include metadata fields only
    const headers = page.locator("thead th");
    await expect(headers.filter({ hasText: /事件ID|Event ID/i })).toHaveCount(
      1,
    );
    await expect(
      headers.filter({ hasText: /safe.*budget|安全预算/i }),
    ).toHaveCount(1);

    // Critically: no column header suggesting prompt/content exposure
    const allHeaderTexts = await headers.allTextContents();
    for (const h of allHeaderTexts) {
      expect(h.toLowerCase()).not.toMatch(/prompt|content|fragment|原文/i);
    }

    // If rows exist, verify no visible prompt text in the row data either
    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    if (count > 0) {
      const firstRowText = await rows.first().textContent();
      // Row should NOT contain long text that looks like a user prompt
      // (heuristic: if any cell exceeds 200 chars it's likely raw content)
      expect(firstRowText?.length ?? 0).toBeLessThan(500);
    }
  });
});

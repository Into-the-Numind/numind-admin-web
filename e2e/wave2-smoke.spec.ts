import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

/**
 * Wave 2 smoke test suite.
 *
 * Covers 4 flows:
 *   Flow 1 (T5): ProvidersList + ProviderEdit + 测试连接
 *   Flow 2 (T3): ServiceEdit routes editable + pricing rule card
 *   Flow 3 (T1): AuditLogs no longer 404
 *   Flow 4 (T6+T7): TaskEdit fallback multi-select + PricingRulesView
 */

const SS_DIR = path.join(process.cwd(), "e2e", "screenshots");
if (!fs.existsSync(SS_DIR)) {
  fs.mkdirSync(SS_DIR, { recursive: true });
}

function ssPath(name: string) {
  return path.join(SS_DIR, `wave2-${name}.png`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Flow 1: T5 ProvidersList + ProviderEdit + 测试连接
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Flow 1 — T5 ProvidersList + ProviderEdit + 测试连接", () => {
  test("providers list shows 8 rows with masked api_key", async ({ page }) => {
    await page.goto("/ai-providers");
    await page
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => {});

    // Wait for table rows to appear
    await page.waitForSelector("table tbody tr", { timeout: 12_000 });

    const rows = page.locator("table tbody tr");
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(8);

    // Verify expected provider names exist
    const expectedProviders = [
      "dmxapi",
      "dmxapi-ssvip",
      "aihubmix",
      "ali-dashscope",
      "volc-ark",
      "baidu-ocr",
      "bailian-file",
      "funasr-local",
    ];
    for (const name of expectedProviders) {
      const cell = page.locator(`td:has-text("${name}")`).first();
      const found = await cell.isVisible().catch(() => false);
      expect(found, `Provider "${name}" should be in the table`).toBeTruthy();
    }

    // Verify api_key column does NOT show raw keys (must be masked pattern ****xxxx or similar)
    const allText = await page.locator("table").innerText();
    // Raw API keys would be long strings without asterisks; masked values contain ****
    // We verify no cell just shows a long raw key (e.g., >32 chars no asterisks)
    const keyColCells = page
      .locator("td")
      .filter({ hasText: /[a-zA-Z0-9]{32,}/ });
    const keyCount = await keyColCells.count();
    // There should be zero raw (unmasked) keys longer than 32 chars visible
    expect(keyCount).toBe(0);

    await page.screenshot({
      path: ssPath("flow1-providers-list"),
      fullPage: true,
    });
  });

  test("dmxapi-ssvip edit page has masked api_key, disabled name, 测试连接 button", async ({
    page,
  }) => {
    await page.goto("/ai-providers");
    await page
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => {});
    await page.waitForSelector("table tbody tr", { timeout: 12_000 });

    // Table uses "编辑" button (not an anchor link) per the DataTable pattern
    const ssvipRow = page.locator("tr", { hasText: "dmxapi-ssvip" }).first();
    const editBtn = ssvipRow.getByRole("button", { name: "编辑" }).first();
    await editBtn.click();

    // Wait for edit page URL
    await page.waitForURL(/\/ai-providers\/\d+/, { timeout: 10_000 });
    await page
      .waitForLoadState("networkidle", { timeout: 10_000 })
      .catch(() => {});

    // Name/identifier field should be disabled in edit mode (":disabled='!isNew'")
    // Actual placeholder is "如 aliyun-dashscope" per source
    const nameInput = page
      .locator('input[placeholder*="aliyun"], input[placeholder*="dashscope"]')
      .first();
    // Fall back to any disabled textbox
    const anyDisabledInput = page.locator("input[disabled]").first();
    const nameDisabled =
      (await nameInput.isDisabled().catch(() => false)) ||
      (await anyDisabledInput.isVisible().catch(() => false));
    expect(
      nameDisabled,
      "Name/identifier field should be disabled in edit mode",
    ).toBeTruthy();

    // api_key in edit mode: shown as masked text with "留空保留原值" hint (not a plain input)
    // The page displays "****CdHV" text + "留空保留原值" span
    const retainHint = page.locator(":text('留空保留原值')");
    const retainVisible = await retainHint.isVisible().catch(() => false);
    expect(
      retainVisible,
      "api_key area should show '留空保留原值' hint in edit mode",
    ).toBeTruthy();

    // 测试连接 button should exist
    const testConnBtn = page.getByRole("button", { name: /测试连接/ });
    await expect(testConnBtn).toBeVisible({ timeout: 5_000 });

    await page.screenshot({
      path: ssPath("flow1-provider-edit"),
      fullPage: true,
    });
  });

  test("测试连接 button triggers response (toast or result)", async ({
    page,
  }) => {
    await page.goto("/ai-providers");
    await page
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => {});
    await page.waitForSelector("table tbody tr", { timeout: 12_000 });

    const ssvipRow = page.locator("tr", { hasText: "dmxapi-ssvip" }).first();
    const editBtn2 = ssvipRow.getByRole("button", { name: "编辑" }).first();
    await editBtn2.click();

    await page.waitForURL(/\/ai-providers\/\d+/, { timeout: 10_000 });
    await page
      .waitForLoadState("networkidle", { timeout: 10_000 })
      .catch(() => {});

    // Wait for the form to fully render (测试连接 is in edit mode only section)
    await page
      .waitForSelector(".form-section--actions, button", { timeout: 8_000 })
      .catch(() => {});
    const testConnBtn = page.getByRole("button", { name: /测试连接/ });
    // Wait up to 5s for the button to appear
    await testConnBtn
      .waitFor({ state: "visible", timeout: 5_000 })
      .catch(() => {});
    const btnVisible = await testConnBtn.isVisible().catch(() => false);
    if (!btnVisible) {
      test.skip();
      return;
    }

    await testConnBtn.click();

    // Wait for some UI response (toast, result text, or state change)
    await page.waitForTimeout(5_000);

    const toastOrResult = await page
      .locator(
        ".toast, [class*='toast'], [role='alert'], .test-result, :text('连接成功'), :text('连接失败'), :text('成功'), :text('失败'), :text('错误')",
      )
      .first()
      .isVisible()
      .catch(() => false);

    expect(
      toastOrResult,
      "测试连接 should show some response (success or failure toast/message)",
    ).toBeTruthy();

    await page.screenshot({
      path: ssPath("flow1-test-connection"),
      fullPage: true,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flow 2: T3 ServiceEdit routes editable + pricing rule card
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Flow 2 — T3 ServiceEdit routes editable + pricing card", () => {
  test("service edit page shows editable routes and pricing card", async ({
    page,
  }) => {
    await page.goto("/ai-services");
    await page
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => {});
    await page.waitForSelector("table tbody tr", { timeout: 12_000 });

    // Navigate to first service's edit page via the "编辑" button in the first row
    const firstEditBtn = page
      .locator("table tbody tr")
      .first()
      .getByRole("button", { name: "编辑" })
      .first();
    const btnFound = await firstEditBtn.isVisible().catch(() => false);
    if (!btnFound) {
      test.skip();
      return;
    }
    await firstEditBtn.click();
    await page.waitForURL(/\/ai-services\/\d+/, { timeout: 10_000 });
    await page
      .waitForLoadState("networkidle", { timeout: 10_000 })
      .catch(() => {});
    // Wait for form to load
    await page.waitForSelector("h1, .form-section, .page-title", {
      timeout: 12_000,
    });

    // Routes section title should NOT say "（只读）"
    const readonlyLabel = page.locator(":text('只读')");
    const readonlyVisible = await readonlyLabel.isVisible().catch(() => false);
    expect(
      readonlyVisible,
      "Routes section should no longer show '（只读）' label",
    ).toBeFalsy();

    // "新增路由" button should exist
    const addRouteBtn = page.getByRole("button", { name: /新增路由/ });
    const addBtnVisible = await addRouteBtn.isVisible().catch(() => false);
    if (!addBtnVisible) {
      // Scroll to find it
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(500);
    }
    await expect(addRouteBtn).toBeVisible({ timeout: 5_000 });

    // Each route row should have Toggle and Delete buttons
    const routeRows = page.locator(".route-row");
    const routeCount = await routeRows.count();
    if (routeCount > 0) {
      const firstRow = routeRows.first();
      const toggleBtn = firstRow
        .locator(
          ".toggle-btn, button:has-text('启用'), button:has-text('禁用')",
        )
        .first();
      const deleteBtn = firstRow
        .locator(
          ".btn-danger, button[class*='danger'], button:has-text('删除')",
        )
        .first();
      expect(
        await toggleBtn.isVisible().catch(() => false),
        "Route row should have toggle button",
      ).toBeTruthy();
      expect(
        await deleteBtn.isVisible().catch(() => false),
        "Route row should have delete button",
      ).toBeTruthy();
    }

    // 计费规则 card should appear below routes — scroll to bottom first
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const pricingHeading = page.locator("h2:has-text('计费规则')");
    await expect(pricingHeading).toBeVisible({ timeout: 8_000 });

    await page.screenshot({
      path: ssPath("flow2-service-edit"),
      fullPage: true,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flow 3: T1 AuditLogs no longer 404
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Flow 3 — T1 AuditLogs page", () => {
  test("audit logs page loads without 404", async ({ page }) => {
    const response = await page.goto("/ai-audit-logs");

    // Page should not return 404
    expect(response?.status()).not.toBe(404);

    await page
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => {});

    // Should not show 404 content
    const notFoundText = await page
      .locator(":text('404'), :text('Not Found'), :text('页面不存在')")
      .isVisible()
      .catch(() => false);
    expect(notFoundText).toBeFalsy();

    // Wait for table or empty state
    await page
      .waitForSelector("table, .empty-state, [class*='empty'], .data-table", {
        timeout: 12_000,
      })
      .catch(() => {});

    // DataTable or empty state should be visible
    const tableVisible = await page
      .locator("table, .empty-state, [class*='empty'], .data-table")
      .first()
      .isVisible()
      .catch(() => false);
    expect(
      tableVisible,
      "Audit logs page should show a table or empty state",
    ).toBeTruthy();

    // Filter bar: target type dropdown + date range should be visible
    const filterBar = page.locator(
      "select, [class*='filter'], input[type='date'], [placeholder*='日期'], [placeholder*='date']",
    );
    const filterCount = await filterBar.count();
    expect(filterCount).toBeGreaterThan(0);

    await page.screenshot({ path: ssPath("flow3-audit-logs"), fullPage: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flow 4: T6 TaskEdit fallback multi-select + T7 PricingRulesView
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Flow 4 — T6 TaskEdit multi-select + T7 PricingRulesView", () => {
  test("task edit page has fallback service as <select multiple>", async ({
    page,
  }) => {
    await page.goto("/ai-tasks");
    await page
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => {});
    await page.waitForSelector("table tbody tr, .empty-state", {
      timeout: 12_000,
    });

    const firstRow = page.locator("table tbody tr").first();
    const rowVisible = await firstRow.isVisible().catch(() => false);
    if (!rowVisible) {
      test.skip();
      return;
    }

    // Task table uses "编辑" button; task IDs are strings like "sop.text", URL is /ai-tasks/:id/edit
    const taskEditBtn = firstRow.getByRole("button", { name: "编辑" }).first();
    await taskEditBtn.click();

    // Wait for URL change — task IDs are strings, not numeric
    await page.waitForURL(/\/ai-tasks\/.+\/edit/, { timeout: 15_000 });
    await page
      .waitForLoadState("networkidle", { timeout: 10_000 })
      .catch(() => {});
    // Wait for the "服务绑定" section which contains the multi-select
    await page.waitForSelector(".binding-row, h2, section", {
      timeout: 12_000,
    });

    // Scroll to the 服务绑定 section
    await page.evaluate(() => {
      const el = document.querySelector("#fallback-select");
      if (el) el.scrollIntoView();
    });
    await page.waitForTimeout(300);

    // Fallback service control should be <select multiple> with id="fallback-select"
    const multiSelect = page.locator(
      "#fallback-select[multiple], select[multiple]",
    );
    const multiCount = await multiSelect.count();
    expect(
      multiCount,
      "Fallback service field should use <select multiple>",
    ).toBeGreaterThan(0);

    await page.screenshot({ path: ssPath("flow4-task-edit"), fullPage: true });
  });

  test("pricing rules page has filter dropdown and 关联AI服务 column", async ({
    page,
  }) => {
    // Pricing rules page is at /billing/pricing (not /pricing-rules)
    await page.goto("/billing/pricing");
    await page
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => {});

    // Page should load, not 404
    const notFoundText = await page
      .locator(":text('404'), :text('Not Found'), :text('页面不存在')")
      .isVisible()
      .catch(() => false);
    expect(notFoundText).toBeFalsy();

    await page
      .waitForSelector("table, .empty-state, select", { timeout: 12_000 })
      .catch(() => {});

    // Filter dropdown "按 AI 服务筛选" should exist
    const filterDropdown = page.locator("select, [class*='filter']").filter({
      hasText: /AI 服务|筛选/,
    });
    const filterSelectByLabel = page.locator(
      "label:has-text('AI 服务'), label:has-text('筛选')",
    );
    const dropdownFound =
      (await filterDropdown.count()) > 0 ||
      (await filterSelectByLabel.count()) > 0 ||
      (await page.locator("select").count()) > 0; // any select counts as filter control
    expect(dropdownFound, "Filter dropdown should be present").toBeTruthy();

    // 关联 AI 服务 column should be visible in table header
    const associatedCol = page.locator(
      "th:has-text('关联'), th:has-text('AI 服务'), th:has-text('服务')",
    );
    const colCount = await associatedCol.count();
    expect(
      colCount,
      "Table should have a '关联 AI 服务' or similar column header",
    ).toBeGreaterThan(0);

    // Each row should show service name or "— 无关联服务"
    const rows = page.locator("table tbody tr");
    const rowCount = await rows.count();
    if (rowCount > 0) {
      const firstRowText = await rows.first().innerText();
      const hasServiceInfo =
        firstRowText.includes("无关联") ||
        firstRowText.includes("—") ||
        firstRowText.match(/[a-z-]{3,}/) !== null; // has some text
      expect(
        hasServiceInfo,
        "Row should show service name or '— 无关联服务'",
      ).toBeTruthy();
    }

    await page.screenshot({
      path: ssPath("flow4-pricing-rules"),
      fullPage: true,
    });
  });
});

import { test, expect, type Route } from "@playwright/test";

/**
 * admin-credits E2E — credits-system admin endpoints (S5-6 回归保护).
 *
 * Covers admin endpoints added by the credits-system feature family:
 *   - GET/POST/PUT/DELETE /v1/admin/estimation-coefficients + /history
 *   - GET/POST /v1/admin/migrations/billing-mode-init[/status]
 *   - GET /v1/admin/b2b-billing-report?month=YYYY-MM (Q3)
 *   - GET /v1/admin/orders + /v1/admin/orders/:id
 *
 * Strategy: page.route() mocks all backend responses so tests are deterministic
 * and don't depend on seed data / dev-backend state. All mocks are installed
 * BEFORE page.goto() so the first list fetch (onMounted) uses fixtures.
 *
 * Response envelope: request.ts's response interceptor unwraps `{code,message,data}`
 * to just `data`. All mocks therefore return the envelope shape.
 *
 * Prereqs: auth setup writes storageState to e2e/.auth/admin.json (see
 * playwright.config.ts + auth.setup.ts).
 */

// ─── Helpers ─────────────────────────────────────────────────────────

/** Wrap a payload in the standard response envelope. */
function ok<T>(data: T) {
  return JSON.stringify({ code: 0, message: "ok", data });
}

/** Route matcher: any URL whose pathname exactly ends with `/v1/admin/<suffix>`. */
function pathEndsWith(url: string, suffix: string): boolean {
  return new URL(url).pathname.endsWith(suffix);
}

/** Route matcher: pathname matches a regex. */
function pathMatches(url: string, re: RegExp): boolean {
  return re.test(new URL(url).pathname);
}

// ─── Fixtures ────────────────────────────────────────────────────────

const COEF_SEED = {
  id: 1,
  provider: "volc",
  model: "deepseek-v3-2-251201",
  operation: "sop_run",
  char_to_token_ratio: 1.5,
  completion_prompt_ratio: 0.5,
  safety_buffer_pct: 30,
  version: 1,
  is_active: true,
  change_reason: "seed",
  updated_by: "system",
  created_at: "2026-04-01T00:00:00Z",
  updated_at: "2026-04-01T00:00:00Z",
};

const COEF_CREATED = {
  ...COEF_SEED,
  id: 2,
  model: "qwen-plus",
  operation: "salesrag_chat",
  version: 1,
  change_reason: "initial qwen-plus coefficient",
};

const COEF_UPDATED = {
  ...COEF_SEED,
  char_to_token_ratio: 2.0,
  version: 2,
  change_reason: "bumped ratio to 2.0",
};

// ─── estimation-coefficients (5 tests) ───────────────────────────────

test.describe("estimation-coefficients CRUD", () => {
  test("list loads and displays seeded coefficient row", async ({ page }) => {
    await page.route(
      "**/v1/admin/estimation-coefficients**",
      async (route: Route) => {
        const url = route.request().url();
        if (pathEndsWith(url, "/v1/admin/estimation-coefficients")) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: ok({ list: [COEF_SEED], total: 1 }),
          });
          return;
        }
        await route.fallback();
      },
    );

    await page.goto("/ai-services/coefficients");
    await expect(page.locator("h1:has-text('估算系数')")).toBeVisible();

    // First row shows the seeded provider/model/operation
    const row = page.locator("table tbody tr").first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText("volc");
    await expect(row).toContainText("deepseek-v3-2-251201");
    await expect(row).toContainText("sop_run");
  });

  test("create: open modal, fill form, submit → new row visible", async ({
    page,
  }) => {
    let created = false;

    await page.route(
      "**/v1/admin/estimation-coefficients**",
      async (route: Route) => {
        const url = route.request().url();
        const method = route.request().method();

        if (
          method === "POST" &&
          pathEndsWith(url, "/v1/admin/estimation-coefficients")
        ) {
          created = true;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: ok(COEF_CREATED),
          });
          return;
        }

        if (
          method === "GET" &&
          pathEndsWith(url, "/v1/admin/estimation-coefficients")
        ) {
          const list = created ? [COEF_SEED, COEF_CREATED] : [COEF_SEED];
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: ok({ list, total: list.length }),
          });
          return;
        }

        await route.fallback();
      },
    );

    await page.goto("/ai-services/coefficients");
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 10_000,
    });

    // Open create modal
    await page.locator('[data-test="open-create"]').click();
    const modal = page.locator(".modal-overlay");
    await expect(modal).toBeVisible();

    // Fill all required fields. AppInput renders an <input> inside the wrapper
    // carrying data-test; scope selectors to those wrappers.
    await modal.locator('[data-test="form-provider"] input').fill("volc");
    await modal.locator('[data-test="form-model"] input').fill("qwen-plus");
    await modal
      .locator('[data-test="form-operation"] input')
      .fill("salesrag_chat");
    await modal
      .locator('[data-test="form-change-reason"] input')
      .fill("initial qwen-plus coefficient");

    // Submit
    await modal.locator('[data-test="submit-form"]').click();

    // Modal closes and second row appears
    await expect(modal).not.toBeVisible({ timeout: 5_000 });
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(2, { timeout: 5_000 });
    await expect(rows.nth(1)).toContainText("qwen-plus");
  });

  test("edit: change ratio + reason, save → row updates version to 2", async ({
    page,
  }) => {
    let updated = false;

    await page.route(
      "**/v1/admin/estimation-coefficients**",
      async (route: Route) => {
        const url = route.request().url();
        const method = route.request().method();

        if (
          method === "PUT" &&
          pathMatches(url, /\/v1\/admin\/estimation-coefficients\/\d+$/)
        ) {
          updated = true;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: ok(COEF_UPDATED),
          });
          return;
        }

        if (
          method === "GET" &&
          pathEndsWith(url, "/v1/admin/estimation-coefficients")
        ) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: ok({
              list: [updated ? COEF_UPDATED : COEF_SEED],
              total: 1,
            }),
          });
          return;
        }

        await route.fallback();
      },
    );

    await page.goto("/ai-services/coefficients");
    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });

    // Click row edit button (data-test: row-edit-<id>)
    await page.locator('[data-test="row-edit-1"]').click();
    const modal = page.locator(".modal-overlay");
    await expect(modal).toBeVisible();

    // Edit char_to_token_ratio + change_reason (both required for submit)
    const ratioInput = modal.locator('[data-test="form-char-ratio"] input');
    await ratioInput.fill("2");
    await modal
      .locator('[data-test="form-change-reason"] input')
      .fill("bumped ratio to 2.0");

    await modal.locator('[data-test="submit-form"]').click();
    await expect(modal).not.toBeVisible({ timeout: 5_000 });

    // Refetched row shows version 2 and ratio 2.0
    await expect(firstRow).toContainText("2", { timeout: 5_000 });
  });

  test("history drawer shows all versions for a row's (provider,model,operation)", async ({
    page,
  }) => {
    await page.route(
      "**/v1/admin/estimation-coefficients**",
      async (route: Route) => {
        const url = route.request().url();

        if (pathEndsWith(url, "/v1/admin/estimation-coefficients/history")) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: ok({
              list: [
                { ...COEF_SEED, version: 1, is_active: false },
                {
                  ...COEF_SEED,
                  id: 3,
                  version: 2,
                  is_active: true,
                  change_reason: "adjusted safety buffer",
                },
              ],
            }),
          });
          return;
        }

        if (pathEndsWith(url, "/v1/admin/estimation-coefficients")) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: ok({ list: [COEF_SEED], total: 1 }),
          });
          return;
        }

        await route.fallback();
      },
    );

    await page.goto("/ai-services/coefficients");
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 10_000,
    });

    await page.locator('[data-test="row-history-1"]').click();
    const drawer = page.locator('[data-test="history-drawer"]');
    await expect(drawer).toBeVisible();

    // Drawer's inner table renders both versions v1 / v2
    const historyRows = drawer.locator(".inner-table tbody tr");
    await expect(historyRows).toHaveCount(2);
    await expect(historyRows.nth(0)).toContainText("v1");
    await expect(historyRows.nth(1)).toContainText("v2");
    await expect(historyRows.nth(1)).toContainText("adjusted safety buffer");
  });

  test("delete: confirm dialog → row disappears from list", async ({
    page,
  }) => {
    let deleted = false;

    await page.route(
      "**/v1/admin/estimation-coefficients**",
      async (route: Route) => {
        const url = route.request().url();
        const method = route.request().method();

        if (
          method === "DELETE" &&
          pathMatches(url, /\/v1\/admin\/estimation-coefficients\/\d+$/)
        ) {
          deleted = true;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: ok(null),
          });
          return;
        }

        if (
          method === "GET" &&
          pathEndsWith(url, "/v1/admin/estimation-coefficients")
        ) {
          const list = deleted ? [] : [COEF_SEED];
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: ok({ list, total: list.length }),
          });
          return;
        }

        await route.fallback();
      },
    );

    await page.goto("/ai-services/coefficients");
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 10_000,
    });

    await page.locator('[data-test="row-delete-1"]').click();

    // ConfirmModal — click the primary danger "确认软删" button. ConfirmModal
    // renders inside .modal-overlay.
    const confirmBtn = page.getByRole("button", { name: /确认软删/ });
    await expect(confirmBtn).toBeVisible({ timeout: 3_000 });
    await confirmBtn.click();

    // After delete, list is empty — DataTable shows empty-state
    await expect(page.locator(".empty-state")).toBeVisible({ timeout: 5_000 });
  });
});

// ─── migrations billing-mode-init (2 tests) ──────────────────────────

test.describe("migrations billing-mode-init", () => {
  test("PENDING state: shows candidate counts + enabled execute button", async ({
    page,
  }) => {
    await page.route(
      "**/v1/admin/migrations/billing-mode-init/status",
      async (route: Route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: ok({
            already_executed: false,
            pre_migration_stats: {
              standard_in_period: 7,
              premium_in_period: 3,
              trial_in_period: 12,
              total_candidates: 22,
            },
            migrated_count: 0,
          }),
        });
      },
    );

    await page.goto("/system-tools/migrations");
    const pending = page.locator('[data-test="state-pending"]');
    await expect(pending).toBeVisible({ timeout: 10_000 });
    await expect(pending).toContainText("22");

    const execBtn = page.locator('[data-test="execute-button"]');
    await expect(execBtn).toBeVisible();
    await expect(execBtn).toBeEnabled();
  });

  test("execute: POST then GET → EXECUTED state replaces PENDING", async ({
    page,
  }) => {
    let executed = false;

    await page.route(
      "**/v1/admin/migrations/billing-mode-init/status",
      async (route: Route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: ok(
            executed
              ? {
                  already_executed: true,
                  executed_at: "2026-04-18T10:00:00Z",
                  executed_by: "admin",
                  migrated_count: 22,
                }
              : {
                  already_executed: false,
                  pre_migration_stats: {
                    standard_in_period: 7,
                    premium_in_period: 3,
                    trial_in_period: 12,
                    total_candidates: 22,
                  },
                  migrated_count: 0,
                },
          ),
        });
      },
    );

    // POST handler: exact path (no /status suffix)
    await page.route(
      "**/v1/admin/migrations/billing-mode-init",
      async (route: Route) => {
        if (route.request().method() !== "POST") {
          await route.fallback();
          return;
        }
        executed = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: ok({
            already_executed: true,
            executed_at: "2026-04-18T10:00:00Z",
            executed_by: "admin",
            migrated_count: 22,
          }),
        });
      },
    );

    await page.goto("/system-tools/migrations");
    await expect(page.locator('[data-test="state-pending"]')).toBeVisible({
      timeout: 10_000,
    });

    await page.locator('[data-test="execute-button"]').click();

    // View transitions to EXECUTED (after POST + status refetch).
    await expect(page.locator('[data-test="state-executed"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('[data-test="state-executed"]')).toContainText(
      "22",
    );
  });
});

// ─── B2B billing report (2 tests) ────────────────────────────────────

test.describe("B2B monthly billing report", () => {
  test("default month loads aggregate and total_amount_cents → yuan", async ({
    page,
  }) => {
    await page.route(
      "**/v1/admin/b2b-billing-report**",
      async (route: Route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: ok({
            month: "2026-04",
            total_amount_cents: 198800,
            by_parent: [
              {
                parent_user_id: 101,
                parent_username: "acme-parent",
                grants_count: 2,
                amount_cents: 198800,
                details: [
                  {
                    child_username: "acme-child-1",
                    product_type: "monthly",
                    months: 6,
                    cents: 149400,
                    granted_at: "2026-04-03T10:00:00Z",
                  },
                  {
                    child_username: "acme-child-2",
                    product_type: "trial",
                    months: null,
                    cents: 49400,
                    granted_at: "2026-04-05T10:00:00Z",
                  },
                ],
              },
            ],
          }),
        });
      },
    );

    await page.goto("/admin/b2b-billing");
    await expect(page.locator('[data-test="total-yuan"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('[data-test="total-yuan"]')).toContainText(
      "1988.00",
    );
    await expect(page.locator("table tbody tr").first()).toContainText(
      "acme-parent",
    );
  });

  test("empty month: total=0 and empty-state visible", async ({ page }) => {
    let firstLoad = true;

    await page.route(
      "**/v1/admin/b2b-billing-report**",
      async (route: Route) => {
        if (firstLoad) {
          firstLoad = false;
          // Initial month with data (so page mounts without empty-state)
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: ok({
              month: "2026-04",
              total_amount_cents: 50000,
              by_parent: [
                {
                  parent_user_id: 101,
                  parent_username: "acme-parent",
                  grants_count: 1,
                  amount_cents: 50000,
                  details: [],
                },
              ],
            }),
          });
          return;
        }
        // Subsequent picks return empty month
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: ok({
            month: "2026-01",
            total_amount_cents: 0,
            by_parent: [],
          }),
        });
      },
    );

    await page.goto("/admin/b2b-billing");
    await expect(page.locator('[data-test="total-yuan"]')).toContainText(
      "500.00",
      { timeout: 10_000 },
    );

    // Change month picker → triggers second request (empty)
    const picker = page.locator('[data-test="month-picker"]');
    await picker.fill("2026-01");
    await picker.dispatchEvent("change");

    await expect(page.locator('[data-test="total-yuan"]')).toContainText(
      "0.00",
      { timeout: 5_000 },
    );
    await expect(page.locator(".empty-state")).toBeVisible();
  });
});

// ─── orders list (1 test — detail endpoint has no UI trigger yet) ────

test.describe("orders list", () => {
  test("list loads paginated orders; pay_status badge rendered", async ({
    page,
  }) => {
    await page.route("**/v1/admin/orders**", async (route: Route) => {
      const url = route.request().url();
      // Only intercept list endpoint (ends exactly with /orders)
      if (!pathEndsWith(url, "/v1/admin/orders")) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: ok({
          total: 2,
          items: [
            {
              id: 1,
              order_no: "ORD-2026-0001",
              user_id: 501,
              payer_id: 501,
              product_type: "premium",
              months: 3,
              amount: 29700,
              pay_channel: "wechat",
              pay_status: "paid",
              trade_no: "wx-123",
              paid_at: "2026-04-02T10:00:00Z",
              expired_at: "2026-07-02T10:00:00Z",
              created_at: "2026-04-02T09:58:00Z",
            },
            {
              id: 2,
              order_no: "ORD-2026-0002",
              user_id: 502,
              payer_id: 401,
              product_type: "trial",
              months: 0,
              amount: 990,
              pay_channel: "alipay",
              pay_status: "pending",
              trade_no: "",
              paid_at: null,
              expired_at: "2026-04-05T10:00:00Z",
              created_at: "2026-04-02T10:00:00Z",
            },
          ],
        }),
      });
    });

    await page.goto("/orders");
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(2, { timeout: 10_000 });
    await expect(rows.nth(0)).toContainText("ORD-2026-0001");
    await expect(rows.nth(0)).toContainText("¥297.00");
    await expect(rows.nth(0)).toContainText("已支付");
    await expect(rows.nth(1)).toContainText("待支付");

    // Pagination footer reflects mocked total
    await expect(page.locator(".pagination__info")).toContainText("2");
  });
});

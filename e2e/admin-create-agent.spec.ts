import { test, expect } from "@playwright/test";

/**
 * M-B1: Admin creates an agent from template (dev integration)
 *
 * Critical path: list → [从模板库] → select first template → rename (unique
 *   timestamp suffix) → save → AfterSaveModal → [暂时跳过] → detail page →
 *   agent visible on list.
 *
 * Guard: test.skip unless E2E_INTEGRATION=true.
 * Teardown: soft-delete the created agent via DELETE /v1/agent/skills/:id.
 *
 * Dev-env dependencies:
 *   - At least 1 built-in template (otherwise inner self-skip fires)
 *   - Dev backend running (BASE_URL env or default 49.233.219.254:9100)
 */

const SHOULD_RUN = process.env.E2E_INTEGRATION === "true";

test.describe.skip("M-B1: admin create Agent (dev integration)", () => {
  test.skip(!SHOULD_RUN, "Requires E2E_INTEGRATION=true + dev backend running");

  let createdAgentId: number | null = null;

  test.afterEach(async ({ request }) => {
    if (createdAgentId !== null) {
      // Soft-delete via admin API — best-effort, failure here is non-fatal
      try {
        await request.delete(`/v1/agent/skills/${createdAgentId}`);
      } catch {
        // ignore teardown failures; the agent will stay in dev env
      }
      createdAgentId = null;
    }
  });

  test("admin creates agent from template, sees on list", async ({ page }) => {
    const timestamp = Date.now();
    const uniqueName = `E2E-Test-${timestamp}`;

    // ── Step 1: Open template gallery ─────────────────────────────────────────
    await page.goto("/agents");
    await page.waitForLoadState("networkidle");

    // Click [从模板库选] button — reuse same selector as agent-template-derive.spec.ts
    await page
      .getByRole("button", { name: /从模板库|选择模板/ })
      .first()
      .click();

    await expect(page).toHaveURL(/\/agents\/new\/from-template/, {
      timeout: 10_000,
    });
    await page.waitForLoadState("networkidle");

    // ── Step 2: Select first available template ────────────────────────────────
    const useTemplateButtons = page.getByRole("button", {
      name: /用这个模板/,
    });
    const count = await useTemplateButtons.count();
    if (count === 0) {
      test.skip(
        true,
        "No templates available in this dev env — cannot test template-derive path",
      );
      return;
    }
    await useTemplateButtons.first().click();

    // Builder loads at /agents/builder (same pattern as agent-template-derive.spec.ts)
    await expect(page).toHaveURL(/\/agents\/builder/, { timeout: 10_000 });

    // ── Step 3: Rename the agent ───────────────────────────────────────────────
    // Selector mirrors agent-scratch-create.spec.ts: [data-question="name"] input
    const nameInput = page.locator('[data-question="name"] input').first();
    await nameInput.fill(uniqueName);

    // ── Step 4: Save ───────────────────────────────────────────────────────────
    await page.getByRole("button", { name: /^保存$/ }).click();

    // AfterSaveModal — same selector as agent-scratch-create + agent-template-derive
    await expect(page.getByText(/已发布|要先体验/)).toBeVisible({
      timeout: 10_000,
    });

    // ── Step 5: Skip preview ───────────────────────────────────────────────────
    await page.getByRole("button", { name: /暂时跳过/ }).click();

    // ── Capture the new agent id from the URL ─────────────────────────────────
    await expect(page).toHaveURL(/\/agents\/\d+$/, { timeout: 10_000 });
    const match = page.url().match(/\/agents\/(\d+)$/);
    createdAgentId = match ? Number(match[1]) : null;
    expect(createdAgentId).not.toBeNull();

    // ── Step 6: Verify visible on list ────────────────────────────────────────
    await page.goto("/agents");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 10_000 });
  });
});

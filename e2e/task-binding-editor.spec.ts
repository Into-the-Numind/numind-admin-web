import { test, expect } from "@playwright/test";

/**
 * Regression suite for TaskBindingEditor (TaskEdit.vue).
 *
 * What this guards against:
 *   The T-A fix in this repo (admin-web d292701, 2026-04-17) repaired a
 *   high-severity data-loss bug where every "save" call on the task-edit
 *   page was silently wiping all service bindings. Root cause: the frontend
 *   wrapped the selection in {binding, override_reason} which the backend
 *   completely ignored, effectively clearing default_service_id /
 *   fallback_service_ids[] / allowed_service_ids[] on every save.
 *
 * What this test does:
 *   1. Open the chatbot.stream task edit page (4 allowed services seeded
 *      in dev per manifest decisions).
 *   2. Toggle the allowed state of one specific service checkbox.
 *   3. Save. Await navigation back to /ai-tasks.
 *   4. Reopen the same task. Assert the toggled state PERSISTED (failure
 *      here = the old data-loss bug has regressed).
 *   5. Toggle back to original and save. Test is idempotent.
 */

const TASK_ID = "chatbot.stream";

test.describe("TaskBindingEditor allowed-service toggle persists", () => {
  test("toggle one allowed service, save, reload, verify persisted", async ({
    page,
  }) => {
    await page.goto(`/ai-tasks/${TASK_ID}/edit`);

    // Wait for the edit form to render. The h1 shows the task's display_name;
    // the sub-line shows the task_id.
    await expect(page.locator(".task-key")).toHaveText(TASK_ID, {
      timeout: 10_000,
    });

    // Pick the second allowed-item as the target (first tends to be the
    // default service, which has its own UI coupling — use a non-default
    // one for the toggle to keep intent clear).
    const allowedItems = page.locator(".allowed-item");
    await expect(allowedItems.nth(1)).toBeVisible();
    const targetItem = allowedItems.nth(1);
    const targetCheckbox = targetItem.locator('input[type="checkbox"]');
    const targetName = await targetItem
      .locator(".svc-name")
      .innerText()
      .then((t) => t.trim());

    const initiallyChecked = await targetCheckbox.isChecked();

    // Toggle.
    await targetCheckbox.click();
    await expect(targetCheckbox).toBeChecked({
      checked: !initiallyChecked,
    });

    // Save.
    await page
      .getByRole("button", { name: /^保存$/ })
      .first()
      .click();

    // Successful save → redirect to /ai-tasks list.
    await page.waitForURL(/\/ai-tasks$/, { timeout: 10_000 });

    // Reopen same task.
    await page.goto(`/ai-tasks/${TASK_ID}/edit`);
    await expect(page.locator(".task-key")).toHaveText(TASK_ID, {
      timeout: 10_000,
    });

    // Find the same service by EXACT name (`hasText` is a substring match and
    // some service display names share prefixes, e.g. "DeepSeek v3.2" vs
    // "DeepSeek V3.2 Thinking").
    const reopenedItem = page.locator(".allowed-item").filter({
      has: page.getByText(targetName, { exact: true }),
    });
    await expect(reopenedItem).toHaveCount(1);
    const reopenedCheckbox = reopenedItem.locator('input[type="checkbox"]');
    await expect(reopenedCheckbox).toBeChecked({
      checked: !initiallyChecked,
    });

    // Idempotence: toggle back and save.
    await reopenedCheckbox.click();
    await expect(reopenedCheckbox).toBeChecked({ checked: initiallyChecked });
    await page
      .getByRole("button", { name: /^保存$/ })
      .first()
      .click();
    await page.waitForURL(/\/ai-tasks$/, { timeout: 10_000 });
  });
});

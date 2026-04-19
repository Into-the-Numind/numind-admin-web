/**
 * Unit tests for B2BBillingReportView (credits-system Q3 / gap-fill).
 *
 * Covers:
 *  - view renders total + parent rows on mount
 *  - month picker change triggers a new fetch with the selected month
 *  - total amount rendering (cents → 元，两位小数)
 *  - row expansion reveals details list with formatted granted_at
 *  - empty state when by_parent is empty
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";

// ---- Mock API module ----
vi.mock("@/api/b2b_billing", () => {
  return {
    getB2BBillingReport: vi.fn(),
  };
});

const toastSpy = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock("@/composables/useToast", () => ({ useToast: () => toastSpy }));

import B2BBillingReportView from "@/views/B2BBillingReportView.vue";
import * as billApi from "@/api/b2b_billing";

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: "/", component: { template: "<div/>" } }],
});

const sampleReport = {
  month: "2026-04",
  total_amount_cents: 198_00 + 99_00, // 297.00 元
  by_parent: [
    {
      parent_user_id: 101,
      parent_username: "acme_admin",
      grants_count: 2,
      amount_cents: 198_00,
      details: [
        {
          child_username: "alice",
          product_type: "monthly" as const,
          months: 1,
          cents: 99_00,
          granted_at: "2026-04-03T10:15:22Z",
        },
        {
          child_username: "bob",
          product_type: "monthly" as const,
          months: 1,
          cents: 99_00,
          granted_at: "2026-04-17T09:05:00Z",
        },
      ],
    },
    {
      parent_user_id: 202,
      parent_username: "widgetco",
      grants_count: 1,
      amount_cents: 99_00,
      details: [
        {
          child_username: "carol",
          product_type: "trial" as const,
          months: null,
          cents: 99_00,
          granted_at: "2026-04-10T00:00:00Z",
        },
      ],
    },
  ],
};

async function mountView() {
  setActivePinia(createPinia());
  const wrapper = mount(B2BBillingReportView, {
    global: { plugins: [router] },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  vi.clearAllMocks();
  toastSpy.success.mockClear();
  toastSpy.error.mockClear();
  document.body.innerHTML = "";
  // Default: current-month request returns the sample report.
  (billApi.getB2BBillingReport as ReturnType<typeof vi.fn>).mockResolvedValue(
    sampleReport,
  );
});

describe("B2BBillingReportView — rendering", () => {
  it("fetches report for the default (current) month on mount", async () => {
    await mountView();
    expect(billApi.getB2BBillingReport).toHaveBeenCalledTimes(1);
    const arg = (billApi.getB2BBillingReport as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    // Default should be current month in YYYY-MM format.
    expect(arg).toMatch(/^\d{4}-\d{2}$/);
  });

  it("renders total amount in 元 with 2 decimals", async () => {
    const wrapper = await mountView();
    // 297_00 cents → 297.00 元
    expect(wrapper.html()).toContain("297.00");
  });

  it("renders one row per parent with grants_count + amount in 元", async () => {
    const wrapper = await mountView();
    const html = wrapper.html();
    expect(html).toContain("acme_admin");
    expect(html).toContain("widgetco");
    // amounts in 元
    expect(html).toContain("198.00");
    expect(html).toContain("99.00");
  });

  it("shows empty state when by_parent is empty", async () => {
    (
      billApi.getB2BBillingReport as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      month: "2026-04",
      total_amount_cents: 0,
      by_parent: [],
    });
    const wrapper = await mountView();
    const html = wrapper.html();
    // DataTable emptyText prop
    expect(html).toContain("暂无本月结算记录");
  });
});

describe("B2BBillingReportView — interactions", () => {
  it("changing the month picker triggers a new fetch with that month", async () => {
    const wrapper = await mountView();
    expect(billApi.getB2BBillingReport).toHaveBeenCalledTimes(1);

    const picker = wrapper.find('[data-test="month-picker"]')
      .element as HTMLInputElement;
    picker.value = "2026-01";
    picker.dispatchEvent(new Event("change", { bubbles: true }));
    await flushPromises();

    expect(billApi.getB2BBillingReport).toHaveBeenCalledTimes(2);
    const secondCall = (billApi.getB2BBillingReport as ReturnType<typeof vi.fn>)
      .mock.calls[1][0];
    expect(secondCall).toBe("2026-01");
  });

  it("expanding a parent row reveals details with formatted granted_at", async () => {
    const wrapper = await mountView();
    // Expand the first parent (acme_admin, id 101)
    const expandBtn = wrapper.find('[data-test="row-expand-101"]');
    expect(expandBtn.exists()).toBe(true);
    await expandBtn.trigger("click");
    await flushPromises();

    const html = wrapper.html();
    // Child usernames now visible
    expect(html).toContain("alice");
    expect(html).toContain("bob");
    // granted_at is formatted "YYYY-MM-DD HH:mm" (first 16 chars of ISO)
    expect(html).toContain("2026-04-03 10:15");
    expect(html).toContain("2026-04-17 09:05");
    // Detail row amounts in 元
    expect(html).toContain("99.00");
  });

  it("displays error alert when fetch fails", async () => {
    (
      billApi.getB2BBillingReport as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(new Error("backend down"));
    const wrapper = await mountView();
    expect(wrapper.html()).toContain("backend down");
  });
});

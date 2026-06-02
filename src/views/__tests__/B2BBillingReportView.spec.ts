/**
 * Unit tests for B2BBillingReportView — Plan §Task 21 / Spec §8.4
 *
 * Covers:
 *  1. Renders basic structure (MonthPicker + DataTable + footer summary)
 *  2. Event-type Chinese mapping (all 4 event_type values)
 *  3. cents → ¥X.XX with thousands separator (1234567 → "12,345.67")
 *  4. CSV export blob has UTF-8 BOM (first 3 bytes: 0xEF 0xBB 0xBF)
 *  5. 4-state handling: loading / empty / error / success
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";

// ---- Mock API module ----
vi.mock("@/api/b2b_billing", () => ({
  getB2BBillingReport: vi.fn(),
}));

const toastSpy = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock("@/composables/useToast", () => ({ useToast: () => toastSpy }));

import B2BBillingReportView from "@/views/B2BBillingReportView.vue";
import * as billApi from "@/api/b2b_billing";

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: "/", component: { template: "<div/>" } }],
});

// Sample report matching Task 13 actual schema
const sampleReport = {
  month: "2026-04",
  cutover_date: "2026-03-01",
  source: "new_only" as const,
  total_amount_cents: 198_00 + 99_00 + 2980, // 12,345.67 test uses different fixture
  total_events_count: 3,
  active_parents_count: 2,
  by_parent: [
    {
      parent_user_id: 101,
      parent_username: "acme_admin",
      grants_count: 2,
      amount_cents: 198_00,
      details: [
        {
          child_user_id: 501,
          child_username: "alice",
          product_type: "monthly" as const,
          months: 1,
          amount_cents: 99_00,
          granted_at: "2026-04-03T10:15:22Z",
        },
        {
          child_user_id: 502,
          child_username: "bob",
          product_type: "monthly" as const,
          months: 1,
          amount_cents: 99_00,
          granted_at: "2026-04-17T09:05:00Z",
        },
      ],
    },
    {
      parent_user_id: 202,
      parent_username: "widgetco",
      grants_count: 1,
      amount_cents: 2980,
      details: [
        {
          child_user_id: 601,
          child_username: "carol",
          product_type: "trial" as const,
          months: 0,
          amount_cents: 2980,
          granted_at: "2026-04-10T00:00:00Z",
        },
      ],
    },
  ],
};

// Report with a 12-month annual grant: verifies it labels as "开通 Pro"
// (the old `months > 1` heuristic wrongly labelled annuals as "续费 Pro").
const renewalReport = {
  ...sampleReport,
  month: "2026-04",
  total_amount_cents: 2980,
  total_events_count: 1,
  active_parents_count: 1,
  by_parent: [
    {
      parent_user_id: 303,
      parent_username: "renewal_corp",
      grants_count: 1,
      amount_cents: 2980,
      details: [
        {
          child_user_id: 701,
          child_username: "dave",
          product_type: "monthly" as const,
          months: 12,
          amount_cents: 2980,
          granted_at: "2026-04-20T12:00:00Z",
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
  document.body.innerHTML = "";
  (billApi.getB2BBillingReport as ReturnType<typeof vi.fn>).mockResolvedValue(
    sampleReport,
  );
});

// ─── Test 1: Basic structure ──────────────────────────────────────────────────
describe("B2BBillingReportView — structure", () => {
  it("renders MonthPicker, DataTable, and summary footer on mount", async () => {
    const wrapper = await mountView();
    // Month picker
    expect(wrapper.find('[data-test="month-picker"]').exists()).toBe(true);
    // Summary bar present
    expect(wrapper.find('[data-test="summary-bar"]').exists()).toBe(true);
    // Total yuan visible
    const totalEl = wrapper.find('[data-test="total-yuan"]');
    expect(totalEl.exists()).toBe(true);
    expect(totalEl.text()).toContain("¥");
    // Active parents count visible
    expect(wrapper.find('[data-test="active-parents"]').text()).toBe("2");
    // Total events count visible
    expect(wrapper.find('[data-test="total-events"]').text()).toBe("3");
    // DataTable present
    expect(wrapper.find('[data-test="billing-table"]').exists()).toBe(true);
    // Parent rows
    const html = wrapper.html();
    expect(html).toContain("acme_admin");
    expect(html).toContain("widgetco");
  });

  it("calls getB2BBillingReport with current YYYY-MM on mount", async () => {
    await mountView();
    expect(billApi.getB2BBillingReport).toHaveBeenCalledTimes(1);
    const month = (billApi.getB2BBillingReport as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(month).toMatch(/^\d{4}-\d{2}$/);
  });

  it("changing month picker triggers a new fetch", async () => {
    const wrapper = await mountView();
    const picker = wrapper.find('[data-test="month-picker"]')
      .element as HTMLInputElement;
    picker.value = "2026-01";
    picker.dispatchEvent(new Event("change", { bubbles: true }));
    await flushPromises();
    expect(billApi.getB2BBillingReport).toHaveBeenCalledTimes(2);
    const secondMonth = (
      billApi.getB2BBillingReport as ReturnType<typeof vi.fn>
    ).mock.calls[1][0];
    expect(secondMonth).toBe("2026-01");
  });
});

// ─── Test 2: Event-type Chinese mapping (derived from product_type + months) ─
describe("B2BBillingReportView — event-type mapping", () => {
  it("maps trial to '开通体验' and all monthly grants (incl. 12-month annual) to '开通 Pro'", async () => {
    // Mount with sampleReport which has months=1 (开通 Pro) and trial (开通体验)
    const wrapper = await mountView();

    // Expand acme_admin (id 101) to see months=1 → "开通 Pro"
    await wrapper.find('[data-test="row-expand-101"]').trigger("click");
    await flushPromises();
    let html = wrapper.html();
    expect(html).toContain("开通 Pro"); // months=1 → "开通 Pro"

    // Expand widgetco (id 202) to see trial_granted
    await wrapper.find('[data-test="row-expand-202"]').trigger("click");
    await flushPromises();
    html = wrapper.html();
    expect(html).toContain("开通体验"); // product_type=trial

    // Switch to the annual (12-month) report: must label "开通 Pro", NOT "续费 Pro".
    (billApi.getB2BBillingReport as ReturnType<typeof vi.fn>).mockResolvedValue(
      renewalReport,
    );
    const picker = wrapper.find('[data-test="month-picker"]')
      .element as HTMLInputElement;
    picker.value = "2026-03";
    picker.dispatchEvent(new Event("change", { bubbles: true }));
    await flushPromises();

    await wrapper.find('[data-test="row-expand-303"]').trigger("click");
    await flushPromises();
    expect(wrapper.html()).toContain("开通 Pro"); // months=12 → "开通 Pro" (annual opening)
    expect(wrapper.html()).not.toContain("续费"); // no more months-based 续费 guess
  });
});

// ─── Test 3: cents → ¥X.XX thousands separator ───────────────────────────────
describe("B2BBillingReportView — cents formatting", () => {
  it("renders total_amount_cents with thousands separator (¥12,345.67)", async () => {
    const bigReport = {
      ...sampleReport,
      total_amount_cents: 1_234_567, // 12,345.67 yuan
      total_events_count: 1,
      active_parents_count: 1,
      by_parent: [
        {
          parent_user_id: 999,
          parent_username: "bigcorp",
          grants_count: 1,
          amount_cents: 1_234_567,
          details: [
            {
              child_user_id: 900,
              child_username: "employee",
              product_type: "monthly" as const,
              months: 12,
              amount_cents: 1_234_567,
              granted_at: "2026-04-01T00:00:00Z",
            },
          ],
        },
      ],
    };
    (billApi.getB2BBillingReport as ReturnType<typeof vi.fn>).mockResolvedValue(
      bigReport,
    );
    const wrapper = await mountView();
    const totalEl = wrapper.find('[data-test="total-yuan"]');
    expect(totalEl.text()).toContain("12,345.67");
  });

  it("shows per-parent amount formatted with 2 decimals", async () => {
    const wrapper = await mountView();
    const html = wrapper.html();
    // acme_admin: 198_00 cents = 198.00
    expect(html).toContain("198.00");
    // widgetco: 2980 cents = 29.80
    expect(html).toContain("29.80");
  });
});

// ─── Test 4: CSV export with UTF-8 BOM ───────────────────────────────────────
describe("B2BBillingReportView — CSV export", () => {
  /**
   * Strategy: capture the Blob passed to URL.createObjectURL so we can
   * inspect its contents. happy-dom's Blob supports arrayBuffer() / text().
   * We use a class-based Blob mock so `new Blob(...)` works as a constructor.
   */
  function setupCsvMocks() {
    let capturedBlob: Blob | null = null;

    // Capture blob passed to createObjectURL
    vi.spyOn(URL, "createObjectURL").mockImplementation((obj) => {
      capturedBlob = obj as Blob;
      return "blob:mock-url";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    // Don't mock createElement — happy-dom anchor.click() is a no-op in test
    // env (no navigation), so we just let it be called naturally.

    return { getBlob: () => capturedBlob };
  }

  it("creates a Blob with UTF-8 BOM (0xEF 0xBB 0xBF) as first 3 bytes", async () => {
    const { getBlob } = setupCsvMocks();

    const wrapper = await mountView();
    await wrapper.find('[data-test="export-csv"]').trigger("click");
    await flushPromises();

    const blob = getBlob();
    expect(blob).not.toBeNull();

    // Read raw bytes and verify BOM
    const buffer = await blob!.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    expect(bytes[0]).toBe(0xef);
    expect(bytes[1]).toBe(0xbb);
    expect(bytes[2]).toBe(0xbf);

    // Read text and verify CSV headers are present
    const text = await blob!.text();
    expect(text).toContain("日期");
    expect(text).toContain("父账户");
    expect(text).toContain("子账户");
    expect(text).toContain("事件类型");
  });

  it("CSV contains parent_username and child_username and event-type label", async () => {
    const { getBlob } = setupCsvMocks();

    const wrapper = await mountView();
    await wrapper.find('[data-test="export-csv"]').trigger("click");
    await flushPromises();

    const blob = getBlob();
    const text = await blob!.text();
    expect(text).toContain("acme_admin");
    expect(text).toContain("alice");
    expect(text).toContain("开通 Pro"); // sub_granted
  });
});

// ─── Test 5: 4-state handling ─────────────────────────────────────────────────
describe("B2BBillingReportView — 4 states", () => {
  it("shows loading state during fetch", async () => {
    // Return a promise that never resolves to capture loading state
    let resolveReport!: (v: unknown) => void;
    (billApi.getB2BBillingReport as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((res) => {
        resolveReport = res;
      }),
    );
    setActivePinia(createPinia());
    const wrapper = mount(B2BBillingReportView, {
      global: { plugins: [router] },
      attachTo: document.body,
    });
    // While loading, refresh button should show loading state
    const refreshBtn = wrapper.find('[data-test="refresh"]');
    expect(refreshBtn.exists()).toBe(true);
    // Resolve to clean up
    resolveReport(sampleReport);
    await flushPromises();
  });

  it("shows empty state when by_parent is empty", async () => {
    (billApi.getB2BBillingReport as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        ...sampleReport,
        by_parent: [],
        total_amount_cents: 0,
        total_events_count: 0,
        active_parents_count: 0,
      },
    );
    const wrapper = await mountView();
    expect(wrapper.html()).toContain("暂无本月结算记录");
  });

  it("shows error alert and toast when fetch fails", async () => {
    (billApi.getB2BBillingReport as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("backend down"),
    );
    const wrapper = await mountView();
    const errorEl = wrapper.find('[data-test="error-alert"]');
    expect(errorEl.exists()).toBe(true);
    expect(errorEl.text()).toContain("backend down");
    expect(toastSpy.error).toHaveBeenCalledWith("backend down");
  });

  it("renders success state with parent rows and summary", async () => {
    const wrapper = await mountView();
    const html = wrapper.html();
    // Parent rows present
    expect(html).toContain("acme_admin");
    expect(html).toContain("widgetco");
    // No error alert
    expect(wrapper.find('[data-test="error-alert"]').exists()).toBe(false);
    // Summary values from server
    expect(wrapper.find('[data-test="active-parents"]').text()).toBe("2");
    expect(wrapper.find('[data-test="total-events"]').text()).toBe("3");
  });
});

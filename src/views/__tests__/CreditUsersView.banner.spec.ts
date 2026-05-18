/**
 * Unit tests for CreditUsersView (Track F.4).
 *
 * Covers:
 *  - "活跃 Reservation" tab appears and lists status='reserved' reservations
 *
 * Note: legacy-tier banner tests were removed in the 2026-05
 * legacy-system-deprecation refactor (T2). billing_mode is now always
 * "credits"; the banner has been deleted.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";

// ---- Mock API ----
vi.mock("@/api/credits", () => {
  const sampleAccount = {
    id: 10,
    user_id: 1,
    balance: 100,
    status: "active",
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  };
  return {
    listCreditUsers: vi.fn(async () => ({
      items: [
        {
          account: sampleAccount,
          user_id: 1,
          username: "alice",
          nickname: "Alice",
        },
      ],
      total: 1,
    })),
    getCreditUserDetail: vi.fn(async (_userId: number) => ({
      account: sampleAccount,
      packages: [],
      transactions: [],
      billing_mode: "credits",
      reservations: [
        {
          id: 1001,
          user_id: 1,
          status: "reserved",
          amount: 15,
          created_at: "2026-04-18T02:00:00Z",
          ref_type: "sop_run",
          ref_id: "run-abc",
        },
        {
          id: 1002,
          user_id: 1,
          status: "reserved",
          amount: 8,
          created_at: "2026-04-18T02:05:00Z",
          ref_type: "sop_run",
          ref_id: "run-def",
        },
      ],
    })),
  };
});

const toastSpy = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock("@/composables/useToast", () => ({ useToast: () => toastSpy }));

import CreditUsersView from "@/views/CreditUsersView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: "/", component: { template: "<div/>" } }],
});

async function mountView() {
  setActivePinia(createPinia());
  const wrapper = mount(CreditUsersView, {
    global: { plugins: [router] },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("CreditUsersView — F.4 reservations tab", () => {
  it("renders 活跃 Reservation tab listing status='reserved' rows", async () => {
    const wrapper = await mountView();
    await wrapper.find('[data-test="row-view-1"]').trigger("click");
    await flushPromises();
    // Click the Reservations tab
    const tab = document.body.querySelector(
      '[data-test="tab-reservations"]',
    ) as HTMLElement | null;
    expect(tab).not.toBeNull();
    tab!.click();
    await flushPromises();
    const panel = document.body.querySelector(
      '[data-test="reservations-panel"]',
    );
    expect(panel).not.toBeNull();
    const html = panel!.innerHTML;
    expect(html).toContain("1001");
    expect(html).toContain("1002");
    expect(html).toContain("run-abc");
  });
});

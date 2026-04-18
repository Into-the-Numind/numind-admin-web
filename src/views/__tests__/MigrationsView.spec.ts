/**
 * Unit tests for MigrationsView (Track F.3).
 *
 * 3-state machine per spec §4.4.3:
 *   PENDING   : already_executed=false; shows candidate count + 执行 button (enabled)
 *   EXECUTING : after button click, while POST in-flight; button disabled + spinner
 *   EXECUTED  : already_executed=true; permanent disable; shows migrated_count +
 *               executed_at + executed_by
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";

// ---- Mock API module (@/api/migrations) ----
vi.mock("@/api/migrations", () => {
  return {
    getBillingModeInitStatus: vi.fn(),
    executeBillingModeInit: vi.fn(),
  };
});

const toastSpy = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock("@/composables/useToast", () => ({ useToast: () => toastSpy }));

import MigrationsView from "@/views/MigrationsView.vue";
import * as migApi from "@/api/migrations";

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: "/", component: { template: "<div/>" } }],
});

async function mountView() {
  setActivePinia(createPinia());
  const wrapper = mount(MigrationsView, {
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
});

describe("MigrationsView — 3-state machine", () => {
  it("PENDING: shows candidate count + enabled execute button", async () => {
    (
      migApi.getBillingModeInitStatus as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      already_executed: false,
      pre_migration_stats: {
        standard_in_period: 42,
        premium_in_period: 7,
        trial_in_period: 3,
        total_candidates: 52,
      },
      migrated_count: 0,
    });
    const wrapper = await mountView();
    expect(wrapper.find('[data-test="state-pending"]').exists()).toBe(true);
    expect(wrapper.html()).toContain("52");
    expect(wrapper.html()).toContain("42");
    expect(wrapper.html()).toContain("7");
    expect(wrapper.html()).toContain("3");
    const btn = wrapper.find('[data-test="execute-button"]');
    expect(btn.exists()).toBe(true);
    expect((btn.element as HTMLButtonElement).disabled).toBe(false);
  });

  it("EXECUTED: renders migrated_count + executed_at + executed_by, button permanently disabled", async () => {
    (
      migApi.getBillingModeInitStatus as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      already_executed: true,
      executed_at: "2026-04-18T03:00:00Z",
      executed_by: "admin",
      migrated_count: 52,
    });
    const wrapper = await mountView();
    expect(wrapper.find('[data-test="state-executed"]').exists()).toBe(true);
    expect(wrapper.html()).toContain("52");
    expect(wrapper.html()).toContain("admin");
    const btn = wrapper.find('[data-test="execute-button"]');
    if (btn.exists()) {
      expect((btn.element as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("EXECUTING: clicking button disables it while POST in-flight, then refreshes to EXECUTED", async () => {
    (
      migApi.getBillingModeInitStatus as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      already_executed: false,
      pre_migration_stats: {
        standard_in_period: 10,
        premium_in_period: 2,
        trial_in_period: 1,
        total_candidates: 13,
      },
      migrated_count: 0,
    });
    // Deferred promise so test can observe the EXECUTING state.
    let resolveExec!: (v: unknown) => void;
    const execPromise = new Promise((r) => (resolveExec = r));
    (
      migApi.executeBillingModeInit as ReturnType<typeof vi.fn>
    ).mockReturnValueOnce(execPromise);
    // After exec resolves, the view calls status again — respond EXECUTED.
    (
      migApi.getBillingModeInitStatus as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      already_executed: true,
      executed_at: "2026-04-18T03:00:00Z",
      executed_by: "admin",
      migrated_count: 13,
    });

    const wrapper = await mountView();
    await wrapper.find('[data-test="execute-button"]').trigger("click");
    // Post-click, pre-resolve: EXECUTING state — button disabled
    await flushPromises();
    expect(wrapper.find('[data-test="state-executing"]').exists()).toBe(true);
    expect(
      (
        wrapper.find('[data-test="execute-button"]')
          .element as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    // Resolve the exec promise → should transition to EXECUTED.
    resolveExec({
      already_executed: true,
      executed_at: "2026-04-18T03:00:00Z",
      executed_by: "admin",
      migrated_count: 13,
    });
    await flushPromises();
    expect(wrapper.find('[data-test="state-executed"]').exists()).toBe(true);
    expect(wrapper.html()).toContain("13");
  });
});

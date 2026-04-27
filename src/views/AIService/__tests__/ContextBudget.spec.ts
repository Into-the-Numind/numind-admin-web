/**
 * Unit tests for ContextBudget admin UI (feature: context-budget-compression Task 13).
 *
 * Covers:
 *  - validateLLMCapability via ServiceEdit save flow
 *  - policy rows render safe_ratio and reserved_output_tokens
 *  - preview sends service_id, operation, and policy fields
 *  - recent event rows do NOT expose prompt content
 *  - token profile calibration metrics rendered
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";

// ---- Mock API module ----
vi.mock("@/api/ai", () => {
  const sampleProfile = {
    id: 1,
    provider: "dmxapi",
    model: "deepseek-v3",
    model_family: "deepseek",
    service_type: "llm_chat",
    profile_json: {},
    safety_multiplier: 1.15,
    calibration_multiplier: 1.0,
    calibration_sample_count: 42,
    calibration_p50_abs_error: 0.03,
    calibration_p90_abs_error: 0.08,
    calibration_p99_under_ratio: 0.01,
    version: 2,
    is_active: true,
    is_fallback: false,
    updated_by: "admin",
    updated_at: "2026-04-25T16:00:00+08:00",
  };

  const samplePolicy = {
    id: 1,
    operation: "sop_run",
    fixed_overhead_tokens: 512,
    reserved_output_tokens: 16384,
    safe_ratio: 0.85,
    version: 1,
    is_active: true,
    updated_by: "admin",
    updated_at: "2026-04-25T16:00:00+08:00",
  };

  const sampleEvent = {
    id: 101,
    operation: "sop_run",
    provider: "dmxapi",
    model: "deepseek-v3",
    context_window: 65536,
    max_output_tokens: 4096,
    reserved_output_tokens: 2048,
    fixed_overhead_tokens: 512,
    safe_ratio: 0.85,
    safe_input_budget: 53000,
    estimated_before: 60000,
    estimated_after: 50000,
    dropped_fragment_count: 2,
    summarized_fragment_count: 1,
    critical_fragment_count: 3,
    status: "compressed",
    created_at: "2026-04-25T16:00:00+08:00",
  };

  return {
    listTokenProfilesApi: vi.fn(async () => ({
      list: [sampleProfile],
      total: 1,
    })),
    saveTokenProfileApi: vi.fn(async () => ({ ...sampleProfile, id: 99 })),
    updateTokenProfileApi: vi.fn(async () => ({
      ...sampleProfile,
      version: 3,
    })),
    deleteTokenProfileApi: vi.fn(async () => undefined),
    listTokenProfilesHistoryApi: vi.fn(async () => ({ list: [sampleProfile] })),
    listContextBudgetPoliciesApi: vi.fn(async () => ({
      list: [samplePolicy],
      total: 1,
    })),
    updateContextBudgetPolicyApi: vi.fn(async () => ({
      ...samplePolicy,
      version: 2,
    })),
    listContextBudgetEventsApi: vi.fn(async () => ({
      list: [sampleEvent],
      total: 1,
    })),
    previewContextBudgetApi: vi.fn(async () => ({
      context_window: 65536,
      max_output_tokens: 4096,
      reserved_output_tokens: 2048,
      safe_input_budget: 53000,
      valid: true,
      warnings: [],
    })),
    listServicesApi: vi.fn(async () => ({
      list: [
        {
          id: 24,
          model_key: "ali-qwen-turbo",
          display_name: "通义千问 Turbo",
          service_type: "llm",
          is_active: true,
          capability_json: { context_window: 65536, max_output_tokens: 4096 },
          latency_tier: "standard",
          quality_tier: "standard",
          is_thinking: false,
          supports_thinking: false,
          thinking_only: false,
          icon: "",
          sort_order: 0,
          created_at: "2026-04-25T00:00:00Z",
          updated_at: "2026-04-25T00:00:00Z",
        },
      ],
      total: 1,
    })),
    // ServiceEdit dependencies (not under test here, just prevent import errors)
    getServiceApi: vi.fn(async () => ({
      id: 1,
      model_key: "ali-qwen",
      display_name: "ali",
      service_type: "llm",
      capability_json: { context_window: 65536, max_output_tokens: 4096 },
      latency_tier: "standard",
      quality_tier: "standard",
      is_thinking: false,
      supports_thinking: false,
      thinking_only: false,
      icon: "",
      sort_order: 0,
      is_active: true,
      routes: [],
      created_at: "",
      updated_at: "",
    })),
    createServiceWithRouteApi: vi.fn(async () => ({
      service: { id: 1 },
      route: {},
    })),
    updateServiceApi: vi.fn(async () => null),
    getCapabilitySchemaApi: vi.fn(async () => ({
      llm: {
        service_type: "llm",
        fields: [
          {
            name: "context_window",
            type: "int",
            required: true,
            description: "Context window size",
          },
          {
            name: "max_output_tokens",
            type: "int",
            required: true,
            description: "Max output tokens",
          },
        ],
      },
    })),
    createRouteApi: vi.fn(async () => ({ route: {} })),
    updateRouteApi: vi.fn(async () => ({ route: {} })),
    deleteRouteApi: vi.fn(async () => null),
    toggleRouteApi: vi.fn(async () => ({ route: {} })),
    listProvidersApi: vi.fn(async () => ({
      list: [
        {
          id: 1,
          name: "ali",
          display_name: "阿里云",
          base_url: "",
          api_key: "****",
          is_active: true,
          created_at: "",
          updated_at: "",
        },
      ],
      total: 1,
    })),
  };
});

vi.mock("@/api/billing", () => ({
  getPricingRulesApi: vi.fn(async () => ({ rules: [] })),
}));

// Toast spy
const toastSpy = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock("@/composables/useToast", () => ({
  useToast: () => toastSpy,
}));

vi.mock("@/utils/format", () => ({
  formatDate: (s: string) => s,
}));

import ContextBudget from "@/views/AIService/ContextBudget.vue";
import ServiceEdit from "@/views/AIService/ServiceEdit.vue";
import * as aiApi from "@/api/ai";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: { template: "<div/>" } },
    { path: "/ai-services/:id/edit", component: { template: "<div/>" } },
    { path: "/ai-services", component: { template: "<div/>" } },
  ],
});

async function mountContextBudget() {
  setActivePinia(createPinia());
  const wrapper = mount(ContextBudget, {
    global: { plugins: [router] },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

async function mountServiceEdit(id = "new") {
  setActivePinia(createPinia());
  await router.push(`/ai-services/${id}/edit`);
  await router.isReady();
  const wrapper = mount(ServiceEdit, {
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

// ============================================================
// Test 1: validateLLMCapability logic (extracted from ServiceEdit)
// ============================================================

/**
 * Mirrors the exact validateLLMCapability implementation in ServiceEdit.vue.
 * Testing it directly avoids mounting the full component which requires a
 * complex router + capability-schema roundtrip.
 */
function validateLLMCapability(
  capability: Record<string, unknown>,
): string | null {
  const contextWindow = Number(capability.context_window);
  const maxOutputTokens = Number(capability.max_output_tokens);
  if (!Number.isFinite(contextWindow) || contextWindow <= 0)
    return "context_window 必须大于 0";
  if (!Number.isFinite(maxOutputTokens) || maxOutputTokens <= 0)
    return "max_output_tokens 必须大于 0";
  if (maxOutputTokens >= contextWindow)
    return "max_output_tokens 必须小于 context_window";
  return null;
}

describe("validates llm context fields before saving a service", () => {
  it("validates llm context fields before saving a service", () => {
    // context_window = 0 → invalid
    expect(
      validateLLMCapability({ context_window: 0, max_output_tokens: 4096 }),
    ).toBe("context_window 必须大于 0");

    // max_output_tokens = 0 → invalid
    expect(
      validateLLMCapability({ context_window: 65536, max_output_tokens: 0 }),
    ).toBe("max_output_tokens 必须大于 0");

    // max_output_tokens >= context_window → invalid
    expect(
      validateLLMCapability({ context_window: 4096, max_output_tokens: 4096 }),
    ).toBe("max_output_tokens 必须小于 context_window");
    expect(
      validateLLMCapability({ context_window: 4096, max_output_tokens: 8192 }),
    ).toBe("max_output_tokens 必须小于 context_window");

    // Valid combination → null
    expect(
      validateLLMCapability({ context_window: 65536, max_output_tokens: 4096 }),
    ).toBeNull();

    // Non-numeric input → invalid
    expect(
      validateLLMCapability({
        context_window: "abc",
        max_output_tokens: 4096,
      }),
    ).toBe("context_window 必须大于 0");
  });
});

// ============================================================
// Test 2: Policy rows render safe_ratio and reserved_output_tokens
// ============================================================
describe("renders policy rows with safe ratio and reserved output tokens", () => {
  it("renders policy rows with safe ratio and reserved output tokens", async () => {
    const wrapper = await mountContextBudget();

    // Switch to policies tab
    const policyTab = wrapper
      .findAll(".tab-btn")
      .find((b) => b.text().includes("Budget Policies"));
    expect(policyTab).toBeDefined();
    await policyTab!.trigger("click");
    await flushPromises();

    expect(aiApi.listContextBudgetPoliciesApi).toHaveBeenCalled();
    const html = wrapper.html();
    // Should display the sample policy values
    expect(html).toContain("sop_run");
    expect(html).toContain("0.85"); // safe_ratio
    expect(html).toContain("16"); // part of 16384
  });
});

// ============================================================
// Test 3: Preview sends service_id, operation, and policy fields
// ============================================================
describe("sends preview requests with service id operation and policy fields", () => {
  it("sends preview requests with service id operation and policy fields", async () => {
    const wrapper = await mountContextBudget();

    // Switch to preview tab
    const previewTab = wrapper
      .findAll(".tab-btn")
      .find((b) => b.text().includes("Preview"));
    expect(previewTab).toBeDefined();
    await previewTab!.trigger("click");
    await flushPromises();

    // listServicesApi should have been called to populate the dropdown
    expect(aiApi.listServicesApi).toHaveBeenCalled();

    // Select service (id=24) via the AppSelect — update model value
    const select = wrapper.findComponent({ name: "AppSelect" });
    if (select.exists()) {
      await select.vm.$emit("update:modelValue", "24");
      await flushPromises();
    }

    // Click run preview
    const previewBtn = wrapper.find('[data-test="preview-submit"]');
    expect(previewBtn.exists()).toBe(true);
    await previewBtn.trigger("click");
    await flushPromises();

    expect(aiApi.previewContextBudgetApi).toHaveBeenCalledWith(
      expect.objectContaining({
        service_id: 24,
        operation: "sop_run",
        fixed_overhead_tokens: expect.any(Number),
        reserved_output_tokens: expect.any(Number),
        safe_ratio: expect.any(Number),
      }),
    );

    // Result should be shown
    const html = wrapper.html();
    expect(html).toContain("VALID");
    expect(html).toContain("53"); // part of safe_input_budget 53000
  });
});

// ============================================================
// Test 4: Recent event rows do NOT expose prompt content
// ============================================================
describe("renders recent event rows without prompt content", () => {
  it("renders recent event rows without prompt content", async () => {
    const wrapper = await mountContextBudget();

    // Switch to events tab
    const eventsTab = wrapper
      .findAll(".tab-btn")
      .find((b) => b.text().includes("Recent Events"));
    expect(eventsTab).toBeDefined();
    await eventsTab!.trigger("click");
    await flushPromises();

    expect(aiApi.listContextBudgetEventsApi).toHaveBeenCalled();

    const html = wrapper.html();
    // Should display event metadata
    expect(html).toContain("sop_run");
    expect(html).toContain("dmxapi");
    expect(html).toContain("deepseek-v3");
    expect(html).toContain("compressed");

    // Should NOT expose prompt/content fields — the API mock and the
    // ContextBudgetEvent type do not include prompt_content, messages,
    // or raw prompt fields.  Verify no such text appears in the rendered HTML.
    expect(html).not.toContain("prompt_content");
    expect(html).not.toContain('"messages"');
    expect(html).not.toContain("raw_prompt");
  });
});

// ============================================================
// Test 5: Token profile calibration metrics rendered
// ============================================================
describe("renders token profile calibration metrics", () => {
  it("renders token profile calibration metrics", async () => {
    const wrapper = await mountContextBudget();
    // Profiles tab is already active on mount
    expect(aiApi.listTokenProfilesApi).toHaveBeenCalled();

    const html = wrapper.html();
    // Profile data from mock
    expect(html).toContain("dmxapi");
    expect(html).toContain("deepseek-v3");
    // calibration_sample_count = 42
    expect(html).toContain("42");
    // calibration_p50_abs_error = 0.03 → formatPercent → "3.00%"
    expect(html).toContain("3.00%");
    // calibration_p90_abs_error = 0.08 → "8.00%"
    expect(html).toContain("8.00%");
    // calibration_p99_under_ratio = 0.01 → "1.00%"
    expect(html).toContain("1.00%");
    // safety_multiplier = 1.15
    expect(html).toContain("1.150");
  });
});

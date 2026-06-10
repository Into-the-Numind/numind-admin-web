/**
 * Regression test: the pricing-rule create form's 供应商 dropdown must reflect
 * providers that exist in the llm_provider table (admin「新增供应商」), not a
 * hardcoded constant list.
 *
 * Bug (customer-reported, prod): a newly created provider `agnes-ai` (id 14)
 * did not appear in the provider dropdown on /billing/pricing when creating a
 * pricing rule, because the options came from a static `providerFormOptions`
 * constant in billingMaps.ts that has to be hand-synced with the DB. The
 * backend accepts any provider string, so this was purely a blind dropdown.
 *
 * This test mocks listProvidersApi to return `agnes-ai` and asserts the create
 * form offers it. It FAILS against the hardcoded-list version (no agnes-ai
 * option) and passes once the dropdown sources from the live provider list.
 *
 * Note: the create modal is <Teleport to="body">, so its <option> elements
 * render into document.body (we mount with attachTo: document.body) — assertions
 * query the document, not the wrapper subtree.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { createRouter, createWebHistory } from "vue-router";

vi.mock("@/api/billing", () => ({
  getPricingRulesApi: vi.fn(async () => ({ rules: [], total: 0 })),
  createPricingRuleApi: vi.fn(async () => ({})),
  updatePricingRuleApi: vi.fn(async () => ({})),
  deletePricingRuleApi: vi.fn(async () => ({})),
  getTiersApi: vi.fn(async () => ({ tiers: [] })),
  replaceTiersApi: vi.fn(async () => ({})),
}));

const provider = (id: number, name: string, display_name: string) => ({
  id,
  name,
  display_name,
  base_url: "",
  api_key: "",
  is_active: true,
  created_at: "",
  updated_at: "",
});

vi.mock("@/api/ai", () => ({
  listServicesApi: vi.fn(async () => ({ list: [], total: 0 })),
  // agnes-ai is NOT in the legacy hardcoded providerLabels constant.
  listProvidersApi: vi.fn(async () => ({
    list: [
      provider(14, "agnes-ai", "Agnes AI"),
      provider(1, "dmxapi", "DMXAPI"),
    ],
    total: 2,
  })),
}));

vi.mock("@/composables/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

import PricingRulesView from "../PricingRulesView.vue";

let wrapper: VueWrapper | null = null;

async function mountAndOpenCreate() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/", component: { template: "<div/>" } }],
  });
  await router.push("/");
  await router.isReady();
  wrapper = mount(PricingRulesView, {
    global: { plugins: [router] },
    attachTo: document.body,
  });
  await flushPromises();
  // Open the create modal so the form (and its provider <select>) renders.
  const createBtn = wrapper
    .findAll("button")
    .find((b) => b.text().includes("新建"));
  if (!createBtn) throw new Error("create button not found");
  await createBtn.trigger("click");
  await flushPromises();
}

function optionValues(): string[] {
  return Array.from(document.querySelectorAll("option"))
    .map((o) => o.getAttribute("value") ?? "")
    .filter(Boolean);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  document.body.innerHTML = "";
});

describe("PricingRulesView provider dropdown (regression: missing agnes-ai)", () => {
  it("offers a newly created provider (agnes-ai) in the create form", async () => {
    await mountAndOpenCreate();
    expect(optionValues()).toContain("agnes-ai");
  });

  it("still offers existing LLM providers and non-LLM billing entities", async () => {
    await mountAndOpenCreate();
    const opts = optionValues();
    // Existing llm_provider from the live list.
    expect(opts).toContain("dmxapi");
    // Non-LLM billing entity not in llm_provider but used by pricing rules.
    expect(opts).toContain("dashvector");
  });
});

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
 * The first test is the Rule 11 reproduction (FAIL → PASS across the fix). The
 * other two are regression guards (existing providers preserved; graceful
 * degradation when the provider API is down).
 *
 * Note: the create modal is <Teleport to="body">, so its <option> elements
 * render into document.body (we mount with attachTo: document.body). The
 * provider <select> is located by its "供应商" label so assertions don't pick up
 * options from the sibling service-type / billing-mode selects.
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
import { listProvidersApi } from "@/api/ai";

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

// Option values of the 供应商 <select> only (located via its label), so we
// don't accidentally match options from the service-type / billing-mode selects.
function providerOptionValues(): string[] {
  const label = Array.from(document.querySelectorAll("label")).find((l) =>
    l.textContent?.includes("供应商"),
  );
  const select = label?.closest(".form-group")?.querySelector("select");
  if (!select) throw new Error("provider select not found");
  return Array.from(select.querySelectorAll("option"))
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
    // Rule 11 reproduction — FAILS against the old hardcoded list.
    expect(providerOptionValues()).toContain("agnes-ai");
  });

  it("still offers existing LLM providers and non-LLM billing entities", async () => {
    // Regression guard — also passed against the old hardcoded list.
    await mountAndOpenCreate();
    const opts = providerOptionValues();
    expect(opts).toContain("dmxapi"); // live llm_provider
    expect(opts).toContain("dashvector"); // non-LLM billing entity
  });

  it("falls back to the non-LLM billing entities when the provider API fails", async () => {
    vi.mocked(listProvidersApi).mockRejectedValueOnce(
      new Error("network down"),
    );
    await mountAndOpenCreate();
    const opts = providerOptionValues();
    // Live list unavailable → no agnes-ai, but the static extras still selectable.
    expect(opts).not.toContain("agnes-ai");
    expect(opts).toEqual(
      expect.arrayContaining(["cos", "vikingdb", "dashvector"]),
    );
  });
});

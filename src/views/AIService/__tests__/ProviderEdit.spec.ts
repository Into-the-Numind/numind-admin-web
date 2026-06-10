/**
 * Regression test for the "新增供应商" create flow (bug: GET /ai/providers/NaN).
 *
 * Root cause: the router has a dedicated `/ai-providers/new` route
 * (name `AIProviderCreate`) that does NOT capture an `:id` param, so
 * `route.params.id` is `undefined` on that page. ProviderEdit.vue detected
 * create-mode via `route.params.id === "new"`, which is `false` for
 * `undefined` → the component fell into EDIT mode and fired
 * `getProviderApi(Number(undefined))` === `getProviderApi(NaN)`, producing
 * `GET /v1/admin/ai/providers/NaN` → 400.
 *
 * These tests pin the corrected behaviour: on the create route the component
 * must NOT fetch a provider, and on an edit route it must fetch by numeric id.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createRouter, createWebHistory } from "vue-router";

const getProviderApi = vi.fn(async (id: number) => ({
  id,
  name: "dmxapi",
  display_name: "DMXAPI",
  base_url: "https://www.dmxapi.cn/v1",
  api_key: "****DP25",
  is_active: true,
  created_at: "2026-04-10T02:03:40+08:00",
  updated_at: "2026-04-10T02:03:40+08:00",
}));

vi.mock("@/api/ai", () => ({
  getProviderApi: (id: number) => getProviderApi(id),
  createProviderApi: vi.fn(async () => ({})),
  updateProviderApi: vi.fn(async () => ({})),
  testProviderConnectionApi: vi.fn(async () => ({ success: true })),
}));

const toastSpy = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock("@/composables/useToast", () => ({ useToast: () => toastSpy }));

import ProviderEdit from "../ProviderEdit.vue";

// Router mirrors the real provider routes: a dedicated param-less `/new`
// route plus the `:id` edit route — both rendering ProviderEdit.
function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: "/", component: { template: "<div/>" } },
      { path: "/ai-providers", component: { template: "<div/>" } },
      {
        path: "/ai-providers/new",
        name: "AIProviderCreate",
        component: ProviderEdit,
      },
      {
        path: "/ai-providers/:id",
        name: "AIProviderEdit",
        component: ProviderEdit,
      },
    ],
  });
}

async function mountAt(path: string) {
  const router = makeRouter();
  router.push(path);
  await router.isReady();
  const wrapper = mount(ProviderEdit, {
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

describe("ProviderEdit create flow (regression: /providers/NaN)", () => {
  it("does NOT fetch a provider on the param-less /ai-providers/new route", async () => {
    const wrapper = await mountAt("/ai-providers/new");

    // Core assertion: the create page must never call getProviderApi.
    // Before the fix this fired getProviderApi(NaN) → GET /providers/NaN → 400.
    expect(getProviderApi).not.toHaveBeenCalled();

    // And it must render in create mode, not edit mode.
    expect(wrapper.text()).toContain("新增 AI 供应商");
    expect(wrapper.text()).not.toContain("编辑 AI 供应商");
  });

  it("fetches the provider by numeric id on the /ai-providers/:id edit route", async () => {
    await mountAt("/ai-providers/7");

    expect(getProviderApi).toHaveBeenCalledTimes(1);
    expect(getProviderApi).toHaveBeenCalledWith(7);
    // Never NaN.
    const arg = getProviderApi.mock.calls[0][0];
    expect(Number.isNaN(arg)).toBe(false);
  });
});

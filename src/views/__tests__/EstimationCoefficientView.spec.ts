/**
 * Unit tests for EstimationCoefficientView (Track F.1).
 *
 * Covers:
 *  - list rendering with DataTable
 *  - create-modal submit (valid form)
 *  - edit-modal with mandatory change_reason
 *  - soft-delete flow via ConfirmModal
 *  - 503 (Coefficient.Concurrent) error → toast "系数更新繁忙"
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";

// ---- Mock API module (@/api/coefficients) ----
vi.mock("@/api/coefficients", () => {
  const sampleItem = {
    id: 1,
    provider: "volc",
    model: "glm-4",
    operation: "sop_step",
    char_to_token_ratio: 3,
    completion_prompt_ratio: 1.5,
    safety_buffer_pct: 20,
    version: 1,
    is_active: true,
    change_reason: "initial",
    updated_by: "admin",
    created_at: "2026-04-18T00:00:00Z",
    updated_at: "2026-04-18T00:00:00Z",
  };
  return {
    listCoefficients: vi.fn(async () => ({ list: [sampleItem], total: 1 })),
    listCoefficientHistory: vi.fn(async () => ({
      list: [
        { ...sampleItem, version: 2, is_active: true, change_reason: "bump" },
        { ...sampleItem, version: 1, is_active: false, change_reason: "init" },
      ],
    })),
    createCoefficient: vi.fn(async () => ({ ...sampleItem, id: 99 })),
    updateCoefficient: vi.fn(async () => ({ ...sampleItem, version: 2 })),
    deleteCoefficient: vi.fn(async () => undefined),
  };
});

// Toast spy
const toastSpy = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock("@/composables/useToast", () => ({
  useToast: () => toastSpy,
}));

/**
 * Modal content is Teleport'd to document.body, so @vue/test-utils
 * `wrapper.find` (component tree) does not see it. These helpers query the
 * raw DOM and fire an `input` event so the v-bound state updates.
 */
function setFieldByTestId(testId: string, value: string) {
  const input = document.body.querySelector(
    `[data-test="${testId}"] input`,
  ) as HTMLInputElement | null;
  if (!input) {
    throw new Error(
      `setFieldByTestId: [data-test="${testId}"] input not found`,
    );
  }
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function clickByTestId(testId: string) {
  const el = document.body.querySelector(
    `[data-test="${testId}"]`,
  ) as HTMLElement | null;
  if (!el) throw new Error(`clickByTestId: [data-test="${testId}"] not found`);
  el.click();
}

import EstimationCoefficientView from "@/views/EstimationCoefficientView.vue";
import * as coefApi from "@/api/coefficients";

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: "/", component: { template: "<div/>" } }],
});

async function mountView() {
  setActivePinia(createPinia());
  const wrapper = mount(EstimationCoefficientView, {
    global: {
      plugins: [router],
    },
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

describe("EstimationCoefficientView — list + CRUD", () => {
  it("renders coefficients from listCoefficients on mount", async () => {
    const wrapper = await mountView();
    expect(coefApi.listCoefficients).toHaveBeenCalledTimes(1);
    const html = wrapper.html();
    expect(html).toContain("volc");
    expect(html).toContain("glm-4");
    expect(html).toContain("sop_step");
  });

  it("submits createCoefficient when new-modal form is valid", async () => {
    const wrapper = await mountView();
    await wrapper.find('[data-test="open-create"]').trigger("click");
    await flushPromises();
    setFieldByTestId("form-provider", "ali");
    setFieldByTestId("form-model", "qwen-plus");
    setFieldByTestId("form-operation", "sop_step");
    setFieldByTestId("form-char-ratio", "3");
    setFieldByTestId("form-completion-ratio", "1.2");
    setFieldByTestId("form-safety", "15");
    setFieldByTestId("form-change-reason", "new provider");
    await flushPromises();
    clickByTestId("submit-form");
    await flushPromises();
    expect(coefApi.createCoefficient).toHaveBeenCalledTimes(1);
    const call = (
      coefApi.createCoefficient as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls[0][0] as { change_reason: string; provider: string };
    expect(call.change_reason).toBe("new provider");
    expect(call.provider).toBe("ali");
    expect(toastSpy.success).toHaveBeenCalled();
  });

  it("requires change_reason when submitting edit form", async () => {
    const wrapper = await mountView();
    const editBtn = wrapper.find('[data-test="row-edit-1"]');
    expect(editBtn.exists()).toBe(true);
    await editBtn.trigger("click");
    await flushPromises();
    // change_reason is intentionally blank on edit-open (never pre-fill old
    // reason). Submitting without filling it must be rejected.
    setFieldByTestId("form-change-reason", "");
    await flushPromises();
    clickByTestId("submit-form");
    await flushPromises();
    expect(coefApi.updateCoefficient).not.toHaveBeenCalled();
    expect(toastSpy.error).toHaveBeenCalled();
  });

  it("submits updateCoefficient with change_reason when edit form is valid", async () => {
    const wrapper = await mountView();
    await wrapper.find('[data-test="row-edit-1"]').trigger("click");
    await flushPromises();
    setFieldByTestId("form-change-reason", "tune ratio");
    setFieldByTestId("form-char-ratio", "4");
    await flushPromises();
    clickByTestId("submit-form");
    await flushPromises();
    expect(coefApi.updateCoefficient).toHaveBeenCalledTimes(1);
    const args = (
      coefApi.updateCoefficient as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls[0];
    expect(args[0]).toBe(1); // id
    expect((args[1] as { change_reason: string }).change_reason).toBe(
      "tune ratio",
    );
  });

  it("soft-deletes via ConfirmModal confirmation", async () => {
    const wrapper = await mountView();
    await wrapper.find('[data-test="row-delete-1"]').trigger("click");
    await flushPromises();
    // ConfirmModal teleported to body; it renders a danger button when
    // `danger` prop is true.
    const confirmBtn = document.body.querySelector(
      ".modal-btn--danger",
    ) as HTMLButtonElement | null;
    expect(confirmBtn).not.toBeNull();
    confirmBtn!.click();
    await flushPromises();
    expect(coefApi.deleteCoefficient).toHaveBeenCalledWith(1);
    expect(toastSpy.success).toHaveBeenCalled();
  });

  it("shows retry toast on 503 Coefficient.Concurrent", async () => {
    const err = new Error("CoefficientConcurrent") as Error & {
      code: string | number;
    };
    err.code = "Coefficient.Concurrent";
    (
      coefApi.updateCoefficient as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(err);
    const wrapper = await mountView();
    await wrapper.find('[data-test="row-edit-1"]').trigger("click");
    await flushPromises();
    setFieldByTestId("form-change-reason", "try update");
    await flushPromises();
    clickByTestId("submit-form");
    await flushPromises();
    expect(toastSpy.error).toHaveBeenCalled();
    const calls = toastSpy.error.mock.calls as unknown as string[][];
    const msg = calls.map((c) => String(c[0])).join(" | ");
    expect(msg).toContain("系数更新繁忙");
  });
});

describe("EstimationCoefficientView — F.2 history drawer", () => {
  it("opens drawer and loads history when row history button clicked", async () => {
    const wrapper = await mountView();
    const histBtn = wrapper.find('[data-test="row-history-1"]');
    expect(histBtn.exists()).toBe(true);
    await histBtn.trigger("click");
    await flushPromises();
    expect(coefApi.listCoefficientHistory).toHaveBeenCalledWith({
      provider: "volc",
      model: "glm-4",
      operation: "sop_step",
    });
    const drawer = document.body.querySelector('[data-test="history-drawer"]');
    expect(drawer).not.toBeNull();
    const html = drawer!.innerHTML;
    expect(html).toContain("bump"); // change_reason v2
    expect(html).toContain("init"); // change_reason v1
    expect(html).toContain("v2");
    expect(html).toContain("v1");
  });

  it("drawer shows empty hint when no history", async () => {
    (
      coefApi.listCoefficientHistory as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({ list: [] });
    const wrapper = await mountView();
    await wrapper.find('[data-test="row-history-1"]').trigger("click");
    await flushPromises();
    const drawer = document.body.querySelector('[data-test="history-drawer"]');
    expect(drawer).not.toBeNull();
    expect(drawer!.innerHTML).toContain("暂无历史版本");
  });
});

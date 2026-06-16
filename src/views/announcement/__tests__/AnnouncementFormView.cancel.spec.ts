/**
 * Rule 11 reproduction + regression: clicking 「取消」 on the announcement edit
 * form must NOT submit the form.
 *
 * Bug (acceptance, customer-reported): the 取消 button had no explicit `type`,
 * so the native <button> inside <form @submit.prevent="handleSubmit"> defaulted
 * to type="submit". Clicking 取消 submitted the form → handleSubmit ran →
 * store.update (PUT) or, when navigation raced ahead of the submit (route id
 * gone → isEditMode false), store.create (POST) → a duplicate announcement.
 *
 * This test mounts the edit form and asserts that clicking 取消 calls NEITHER
 * create NOR update (cancel just navigates away). It FAILS before the fix
 * (type="button" on the cancel button) and PASSES after.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createRouter, createWebHistory } from "vue-router";
import { createPinia, setActivePinia } from "pinia";

const getAnnouncementApi = vi.fn();
const createAnnouncementApi = vi.fn(async () => ({ id: 999 }));
const updateAnnouncementApi = vi.fn(async () => ({ id: 1 }));

vi.mock("@/api/announcements", () => ({
  listAnnouncementsApi: vi.fn(async () => ({ list: [], total: 0 })),
  getAnnouncementApi: (...a: unknown[]) => getAnnouncementApi(...a),
  createAnnouncementApi: (...a: unknown[]) => createAnnouncementApi(...a),
  updateAnnouncementApi: (...a: unknown[]) => updateAnnouncementApi(...a),
  publishAnnouncementApi: vi.fn(async () => ({})),
  archiveAnnouncementApi: vi.fn(async () => ({})),
  deleteAnnouncementApi: vi.fn(async () => ({})),
  getStatsApi: vi.fn(async () => ({})),
  getReadersApi: vi.fn(async () => ({ list: [], total: 0 })),
  getSurveyResultsApi: vi.fn(async () => ({
    response_count: 0,
    questions: [],
  })),
  getResponsesApi: vi.fn(async () => ({ list: [], total: 0 })),
}));

vi.mock("@/composables/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

import AnnouncementFormView from "../AnnouncementFormView.vue";

function makeRouter() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      {
        path: "/announcements",
        name: "list",
        component: { template: "<div/>" },
      },
      {
        path: "/announcements/:id/edit",
        name: "edit",
        component: AnnouncementFormView,
      },
    ],
  });
  return router;
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  getAnnouncementApi.mockResolvedValue({
    id: 1,
    type: "plain",
    title: "已发布公告",
    content: "正文",
    is_important: false,
    status: "published",
    published_at: "2026-06-16T00:00:00Z",
    expires_at: null,
    created_at: "2026-06-16T00:00:00Z",
    questions: [],
  });
});

describe("AnnouncementFormView 取消按钮", () => {
  it("点击「取消」不提交表单（不调 create/update），只离开", async () => {
    const router = makeRouter();
    router.push("/announcements/1/edit");
    await router.isReady();

    const wrapper = mount(AnnouncementFormView, {
      global: { plugins: [router] },
      attachTo: document.body,
    });
    await flushPromises(); // loadDetail 完成

    const cancelBtn = wrapper
      .findAll("button")
      .find((b) => b.text().trim() === "取消");
    expect(cancelBtn, "应渲染取消按钮").toBeTruthy();

    // 关键回归：取消按钮必须 type="button"，不能是 submit（否则点它会提交表单）
    expect(cancelBtn!.attributes("type")).toBe("button");

    await cancelBtn!.trigger("click");
    await flushPromises();

    // 取消绝不能保存：既不创建也不更新
    expect(createAnnouncementApi).not.toHaveBeenCalled();
    expect(updateAnnouncementApi).not.toHaveBeenCalled();

    wrapper.unmount();
  });
});

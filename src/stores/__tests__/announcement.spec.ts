import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAnnouncementStore } from "../announcement";
import type {
  AdminAnnouncementBrief,
  AdminAnnouncementDetail,
  StatsDTO,
} from "@/api/announcements";

// Mock the api module (vi.mock is hoisted)
vi.mock("@/api/announcements", () => ({
  listAnnouncementsApi: vi.fn(),
  createAnnouncementApi: vi.fn(),
  getAnnouncementApi: vi.fn(),
  updateAnnouncementApi: vi.fn(),
  publishAnnouncementApi: vi.fn(),
  archiveAnnouncementApi: vi.fn(),
  deleteAnnouncementApi: vi.fn(),
  getStatsApi: vi.fn(),
  getReadersApi: vi.fn(),
  getSurveyResultsApi: vi.fn(),
  getResponsesApi: vi.fn(),
}));

import * as api from "@/api/announcements";

const mockBrief: AdminAnnouncementBrief = {
  id: 1,
  type: "plain",
  title: "系统维护通知",
  status: "published",
  is_important: false,
  published_at: "2026-06-16T00:00:00Z",
  expires_at: null,
  created_at: "2026-06-16T00:00:00Z",
  read_count: 80,
  target_count: 120,
  response_count: 0,
};

const mockDetail: AdminAnnouncementDetail = {
  ...mockBrief,
  content: "# 维护说明",
  questions: [],
};

const mockStats: StatsDTO = {
  target_count: 120,
  read_count: 80,
  read_rate: 0.667,
  response_count: 45,
  response_rate: 0.375,
};

describe("useAnnouncementStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(api.listAnnouncementsApi).mockReset();
    vi.mocked(api.createAnnouncementApi).mockReset();
    vi.mocked(api.getAnnouncementApi).mockReset();
    vi.mocked(api.updateAnnouncementApi).mockReset();
    vi.mocked(api.publishAnnouncementApi).mockReset();
    vi.mocked(api.archiveAnnouncementApi).mockReset();
    vi.mocked(api.deleteAnnouncementApi).mockReset();
    vi.mocked(api.getStatsApi).mockReset();
    vi.mocked(api.getReadersApi).mockReset();
    vi.mocked(api.getSurveyResultsApi).mockReset();
    vi.mocked(api.getResponsesApi).mockReset();
  });

  it("initial state is empty", () => {
    const s = useAnnouncementStore();
    expect(s.list).toEqual([]);
    expect(s.total).toBe(0);
    expect(s.current).toBeNull();
    expect(s.stats).toBeNull();
    expect(s.isEmpty).toBe(true);
  });

  it("fetchList populates list + total and clears isEmpty", async () => {
    vi.mocked(api.listAnnouncementsApi).mockResolvedValue({
      list: [mockBrief],
      total: 1,
    });
    const s = useAnnouncementStore();
    await s.fetchList();
    expect(api.listAnnouncementsApi).toHaveBeenCalledWith({
      page: 1,
      page_size: 20,
    });
    expect(s.list).toHaveLength(1);
    expect(s.total).toBe(1);
    expect(s.isEmpty).toBe(false);
    expect(s.loading).toBe(false);
  });

  it("fetchList passes through status/type filters", async () => {
    vi.mocked(api.listAnnouncementsApi).mockResolvedValue({
      list: [],
      total: 0,
    });
    const s = useAnnouncementStore();
    await s.fetchList({ status: "draft", type: "survey" });
    expect(api.listAnnouncementsApi).toHaveBeenCalledWith({
      page: 1,
      page_size: 20,
      status: "draft",
      type: "survey",
    });
  });

  it("fetchList error sets error string and re-throws", async () => {
    vi.mocked(api.listAnnouncementsApi).mockRejectedValue(new Error("network"));
    const s = useAnnouncementStore();
    await expect(s.fetchList()).rejects.toThrow("network");
    expect(s.error).toBe("network");
    expect(s.loading).toBe(false);
    expect(s.list).toEqual([]);
  });

  it("create calls api, toggles saving, and sets current", async () => {
    vi.mocked(api.createAnnouncementApi).mockResolvedValue(mockDetail);
    const s = useAnnouncementStore();
    const payload = {
      type: "plain",
      title: "系统维护通知",
      content: "# 维护说明",
    };
    const r = await s.create(payload);
    expect(api.createAnnouncementApi).toHaveBeenCalledWith(payload);
    expect(r).toEqual(mockDetail);
    expect(s.current).toEqual(mockDetail);
    expect(s.saving).toBe(false);
  });

  it("create resets saving even on failure", async () => {
    vi.mocked(api.createAnnouncementApi).mockRejectedValue(new Error("boom"));
    const s = useAnnouncementStore();
    await expect(
      s.create({ type: "plain", title: "x", content: "y" }),
    ).rejects.toThrow("boom");
    expect(s.saving).toBe(false);
  });

  it("get sets current and returns the detail", async () => {
    vi.mocked(api.getAnnouncementApi).mockResolvedValue(mockDetail);
    const s = useAnnouncementStore();
    const r = await s.get(1);
    expect(r).toEqual(mockDetail);
    expect(s.current).toEqual(mockDetail);
    expect(s.currentLoading).toBe(false);
  });

  it("publish updates current and syncs the in-list row", async () => {
    const published = { ...mockDetail, status: "published" };
    vi.mocked(api.publishAnnouncementApi).mockResolvedValue(published);
    const s = useAnnouncementStore();
    s.list = [{ ...mockBrief, status: "draft" }];
    const r = await s.publish(1);
    expect(api.publishAnnouncementApi).toHaveBeenCalledWith(1);
    expect(r.status).toBe("published");
    expect(s.current?.status).toBe("published");
    expect(s.list[0].status).toBe("published");
  });

  it("update calls api, sets current, and syncs the in-list row", async () => {
    const updated = { ...mockDetail, title: "x" };
    vi.mocked(api.updateAnnouncementApi).mockResolvedValue(updated);
    const s = useAnnouncementStore();
    s.list = [{ ...mockBrief, title: "系统维护通知" }];
    const r = await s.update(1, { title: "x" });
    expect(api.updateAnnouncementApi).toHaveBeenCalledWith(1, { title: "x" });
    expect(r.title).toBe("x");
    expect(s.current?.title).toBe("x");
    expect(s.list[0].title).toBe("x");
    expect(s.saving).toBe(false);
  });

  it("archive calls api and syncs the in-list status", async () => {
    const archived = { ...mockDetail, status: "archived" };
    vi.mocked(api.archiveAnnouncementApi).mockResolvedValue(archived);
    const s = useAnnouncementStore();
    s.list = [{ ...mockBrief, status: "published" }];
    const r = await s.archive(1);
    expect(api.archiveAnnouncementApi).toHaveBeenCalledWith(1);
    expect(r.status).toBe("archived");
    expect(s.current?.status).toBe("archived");
    expect(s.list[0].status).toBe("archived");
    expect(s.saving).toBe(false);
  });

  it("remove is optimistic: filters list locally", async () => {
    vi.mocked(api.deleteAnnouncementApi).mockResolvedValue({ deleted: true });
    const s = useAnnouncementStore();
    s.list = [mockBrief, { ...mockBrief, id: 2 }];
    s.total = 2;
    await s.remove(1);
    expect(s.list).toHaveLength(1);
    expect(s.list[0].id).toBe(2);
    expect(s.total).toBe(1);
  });

  it("fetchStats stores stats", async () => {
    vi.mocked(api.getStatsApi).mockResolvedValue(mockStats);
    const s = useAnnouncementStore();
    const r = await s.fetchStats(1);
    expect(api.getStatsApi).toHaveBeenCalledWith(1);
    expect(r).toEqual(mockStats);
    expect(s.stats).toEqual(mockStats);
    expect(s.loading).toBe(false);
  });

  it("fetchReaders stores readers + total with default paging", async () => {
    vi.mocked(api.getReadersApi).mockResolvedValue({
      list: [
        {
          user_id: 7,
          nickname: "小明",
          phone: "138****",
          read_at: "2026-06-16T01:00:00Z",
        },
      ],
      total: 80,
    });
    const s = useAnnouncementStore();
    await s.fetchReaders(1, { status: "read" });
    expect(api.getReadersApi).toHaveBeenCalledWith(1, {
      page: 1,
      page_size: 20,
      status: "read",
    });
    expect(s.readers).toHaveLength(1);
    expect(s.readersTotal).toBe(80);
  });

  it("fetchSurveyResults stores aggregated results", async () => {
    vi.mocked(api.getSurveyResultsApi).mockResolvedValue({
      response_count: 45,
      questions: [
        {
          question_id: 10,
          title: "满意度",
          question_type: "single",
          option_counts: [
            { option: "A", count: 30 },
            { option: "B", count: 15 },
          ],
        },
      ],
    });
    const s = useAnnouncementStore();
    const r = await s.fetchSurveyResults(1);
    expect(r.response_count).toBe(45);
    expect(s.surveyResults?.questions).toHaveLength(1);
  });

  it("fetchStats error sets error string and re-throws", async () => {
    vi.mocked(api.getStatsApi).mockRejectedValue(new Error("stat-fail"));
    const s = useAnnouncementStore();
    await expect(s.fetchStats(1)).rejects.toThrow("stat-fail");
    expect(s.error).toBe("stat-fail");
    expect(s.loading).toBe(false);
  });

  it("$reset clears all state", async () => {
    vi.mocked(api.listAnnouncementsApi).mockResolvedValue({
      list: [mockBrief],
      total: 1,
    });
    vi.mocked(api.getStatsApi).mockResolvedValue(mockStats);
    const s = useAnnouncementStore();
    await s.fetchList();
    await s.fetchStats(1);
    expect(s.list).toHaveLength(1);
    expect(s.stats).not.toBeNull();
    s.$reset();
    expect(s.list).toEqual([]);
    expect(s.total).toBe(0);
    expect(s.current).toBeNull();
    expect(s.stats).toBeNull();
    expect(s.isEmpty).toBe(true);
  });
});

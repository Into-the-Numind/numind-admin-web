import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAgentStore } from "../agent";
import type { Agent, SkillTemplate, AgentHistory } from "@/types/agent";

// Mock the api module (vi.mock is hoisted)
vi.mock("@/api/agent", () => ({
  listAgentsApi: vi.fn(),
  getAgentApi: vi.fn(),
  createAgentApi: vi.fn(),
  patchAgentApi: vi.fn(),
  deleteAgentApi: vi.fn(),
  listAgentHistoryApi: vi.fn(),
  restoreAgentApi: vi.fn(),
  toggleAgentAdvancedApi: vi.fn(),
  listSkillTemplatesApi: vi.fn(),
}));

import * as api from "@/api/agent";

const mockAgent: Agent = {
  id: 1,
  parent_user_id: 100,
  name: "test agent",
  description: "desc",
  icon_url: "lucide:Bot",
  welcome_message: "hi",
  starters: [],
  questionnaire_answers: {
    q6: ["analyze_data"],
    q7: ["text"],
    q8: 800,
    q9: "no_web_search",
    q11: "",
    q12: "friendly",
  },
  generated_skill_body: "## 角色定义\n",
  advanced_mode: false,
  custom_skill_body: "",
  tool_flags: {},
  credit_cap_per_session: null,
  daily_credit_cap: null,
  version: 1,
  is_active: true,
  source_template_id: null,
  created_by: 100,
  created_at: "2026-05-21T00:00:00Z",
  updated_at: "2026-05-21T00:00:00Z",
};

const mockTemplate: SkillTemplate = {
  id: 1,
  name: "学员爆款分析师",
  description: "分析笔记",
  icon_url: "lucide:Sparkles",
  welcome_message: "你好",
  starters: ["帮我分析"],
  questionnaire_answers: {
    q6: ["analyze_data"],
    q7: ["text"],
    q8: 800,
    q9: "no_web_search",
    q12: "friendly",
  },
  tool_flags: { code_sandbox: true },
  credit_cap_per_session: null,
  daily_credit_cap: null,
  created_at: "2026-05-21T00:00:00Z",
};

const mockHistory: AgentHistory = {
  id: 10,
  agent_id: 1,
  version: 1,
  snapshot: mockAgent,
  changes_summary: "首次发布",
  created_by: 100,
  created_at: "2026-05-21T00:00:00Z",
};

describe("useAgentStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(api.listAgentsApi).mockReset();
    vi.mocked(api.getAgentApi).mockReset();
    vi.mocked(api.createAgentApi).mockReset();
    vi.mocked(api.patchAgentApi).mockReset();
    vi.mocked(api.deleteAgentApi).mockReset();
    vi.mocked(api.listAgentHistoryApi).mockReset();
    vi.mocked(api.restoreAgentApi).mockReset();
    vi.mocked(api.toggleAgentAdvancedApi).mockReset();
    vi.mocked(api.listSkillTemplatesApi).mockReset();
  });

  it("initial state is empty", () => {
    const s = useAgentStore();
    expect(s.list).toEqual([]);
    expect(s.total).toBe(0);
    expect(s.current).toBeNull();
    expect(s.isEmpty).toBe(true);
  });

  it("fetchList populates list+total; default include_inactive=false", async () => {
    vi.mocked(api.listAgentsApi).mockResolvedValue({
      list: [mockAgent],
      total: 1,
    });
    const s = useAgentStore();
    await s.fetchList();
    expect(api.listAgentsApi).toHaveBeenCalledWith({
      page: 1,
      page_size: 20,
      include_inactive: false,
    });
    expect(s.list).toHaveLength(1);
    expect(s.total).toBe(1);
    expect(s.isEmpty).toBe(false);
    expect(s.loading).toBe(false);
  });

  it("fetchList error sets error string and re-throws", async () => {
    vi.mocked(api.listAgentsApi).mockRejectedValue(new Error("network"));
    const s = useAgentStore();
    await expect(s.fetchList()).rejects.toThrow("network");
    expect(s.error).toBe("network");
    expect(s.loading).toBe(false);
  });

  it("fetchOne sets current after normalize", async () => {
    vi.mocked(api.getAgentApi).mockResolvedValue(mockAgent);
    const s = useAgentStore();
    await s.fetchOne(1);
    expect(s.current).toEqual(mockAgent);
  });

  it("normalize strips invalid q9 empty string", async () => {
    const a = { ...mockAgent, questionnaire_answers: { q9: "" as never } };
    vi.mocked(api.getAgentApi).mockResolvedValue(a);
    const s = useAgentStore();
    await s.fetchOne(1);
    expect(s.current?.questionnaire_answers.q9).toBeUndefined();
  });

  it("create sets current and returns the created agent", async () => {
    vi.mocked(api.createAgentApi).mockResolvedValue(mockAgent);
    const s = useAgentStore();
    const r = await s.create({ name: "test agent" });
    expect(r).toEqual(mockAgent);
    expect(s.current).toEqual(mockAgent);
  });

  it("update calls patchAgentApi and updates current", async () => {
    const updated = { ...mockAgent, name: "renamed" };
    vi.mocked(api.patchAgentApi).mockResolvedValue(updated);
    const s = useAgentStore();
    const r = await s.update(1, { name: "renamed" });
    expect(api.patchAgentApi).toHaveBeenCalledWith(1, { name: "renamed" });
    expect(r.name).toBe("renamed");
    expect(s.current?.name).toBe("renamed");
  });

  it("softDelete is optimistic: filters list locally", async () => {
    vi.mocked(api.deleteAgentApi).mockResolvedValue(undefined);
    const s = useAgentStore();
    s.list = [mockAgent, { ...mockAgent, id: 2 }];
    s.total = 2;
    await s.softDelete(1);
    expect(s.list).toHaveLength(1);
    expect(s.list[0].id).toBe(2);
    expect(s.total).toBe(1);
  });

  it("fetchHistory populates history list", async () => {
    vi.mocked(api.listAgentHistoryApi).mockResolvedValue({
      list: [mockHistory],
      total: 1,
    });
    const s = useAgentStore();
    await s.fetchHistory(1);
    expect(s.history).toEqual([mockHistory]);
  });

  it("restore creates new version + refreshes history", async () => {
    vi.mocked(api.restoreAgentApi).mockResolvedValue({
      ...mockAgent,
      version: 3,
    });
    vi.mocked(api.listAgentHistoryApi).mockResolvedValue({
      list: [{ ...mockHistory, version: 3, changes_summary: "从 v1 恢复" }],
      total: 1,
    });
    const s = useAgentStore();
    const r = await s.restore(1, 1);
    expect(api.restoreAgentApi).toHaveBeenCalledWith(1, 1);
    expect(r.version).toBe(3);
    expect(s.history[0].changes_summary).toBe("从 v1 恢复");
  });

  it("toggleAdvanced flips advanced_mode true", async () => {
    vi.mocked(api.toggleAgentAdvancedApi).mockResolvedValue({
      ...mockAgent,
      advanced_mode: true,
    });
    const s = useAgentStore();
    const r = await s.toggleAdvanced(1);
    expect(r.advanced_mode).toBe(true);
    expect(s.current?.advanced_mode).toBe(true);
  });

  it("fetchTemplates populates templates list", async () => {
    vi.mocked(api.listSkillTemplatesApi).mockResolvedValue([mockTemplate]);
    const s = useAgentStore();
    await s.fetchTemplates();
    expect(s.templates).toEqual([mockTemplate]);
  });

  it("$reset clears all state", async () => {
    vi.mocked(api.listAgentsApi).mockResolvedValue({
      list: [mockAgent],
      total: 1,
    });
    vi.mocked(api.getAgentApi).mockResolvedValue(mockAgent);
    const s = useAgentStore();
    await s.fetchList();
    await s.fetchOne(1);
    expect(s.list).toHaveLength(1);
    expect(s.current).not.toBeNull();
    s.$reset();
    expect(s.list).toEqual([]);
    expect(s.total).toBe(0);
    expect(s.current).toBeNull();
    expect(s.isEmpty).toBe(true);
  });
});

// API wrappers for /v1/agent/skills/* (9 endpoints, user_token middleware).
// Backend: numind-server feature #5 agent-mode-skill-system (merged e05498b6).
// Parent-account only — child accounts receive HTTP 403 from backend biz layer.

import { get, post, patch, del } from "./request";
import type {
  Agent,
  AgentHistory,
  SkillTemplate,
  CreateAgentPayload,
  PatchAgentPayload,
  ListResponse,
} from "@/types/agent";

export interface ListAgentsParams {
  page?: number;
  page_size?: number;
  include_inactive?: boolean;
}

// 1. POST   /v1/agent/skills              — Create
export function createAgentApi(payload: CreateAgentPayload): Promise<Agent> {
  return post<Agent>("/v1/agent/skills", payload);
}

// 2. GET    /v1/agent/skills              — List (parent's own agents)
export function listAgentsApi(
  params: ListAgentsParams = {},
): Promise<ListResponse<Agent>> {
  return get<ListResponse<Agent>>("/v1/agent/skills", { params });
}

// 3. GET    /v1/agent/skills/:id          — Get one
export function getAgentApi(id: number): Promise<Agent> {
  return get<Agent>(`/v1/agent/skills/${id}`);
}

// 4. PATCH  /v1/agent/skills/:id          — Partial update
export function patchAgentApi(
  id: number,
  payload: PatchAgentPayload,
): Promise<Agent> {
  return patch<Agent>(`/v1/agent/skills/${id}`, payload);
}

// 5. DELETE /v1/agent/skills/:id          — Soft delete (is_active=false)
export function deleteAgentApi(id: number): Promise<void> {
  return del<void>(`/v1/agent/skills/${id}`);
}

// 6. GET    /v1/agent/skills/:id/history  — Version history (sorted desc)
export function listAgentHistoryApi(
  id: number,
): Promise<ListResponse<AgentHistory>> {
  return get<ListResponse<AgentHistory>>(`/v1/agent/skills/${id}/history`);
}

// 7. POST   /v1/agent/skills/:id/restore/:version  — Restore (creates new version)
export function restoreAgentApi(id: number, version: number): Promise<Agent> {
  return post<Agent>(`/v1/agent/skills/${id}/restore/${version}`);
}

// 8. POST   /v1/agent/skills/:id/advanced-toggle   — Switch to advanced (irreversible)
export function toggleAgentAdvancedApi(id: number): Promise<Agent> {
  return post<Agent>(`/v1/agent/skills/${id}/advanced-toggle`);
}

// 9. GET    /v1/agent/skill-templates              — Built-in templates (no pagination)
export function listSkillTemplatesApi(): Promise<SkillTemplate[]> {
  return get<SkillTemplate[]>("/v1/agent/skill-templates");
}

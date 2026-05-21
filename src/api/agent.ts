// API wrappers for admin-only agent run monitoring endpoints.
// User-facing agent CRUD wrappers moved to numind-web-v3/src/api/agentBuilder.ts
// per feature agent-mode-configurator-relocate (2026-05-22).
//
// Admin monitoring endpoints (admin_token middleware):
//   GET  /v1/admin/agent-runs        — list runs (M-C4a backend)
//   POST /v1/admin/agent-runs/:id/cancel — force cancel (M-C3b backend)

import { get, post } from "./request";
import type { AgentRunDTO, ListResponse } from "@/types/agent";

export interface ListRunsParams {
  status?: "running" | "terminated" | "cancelled";
  page?: number;
  page_size?: number;
  parent_user_id?: number;
}

// GET /v1/admin/agent-runs — list agent runs with optional filters (M-C4a)
export function listAgentRunsApi(
  params: ListRunsParams = {},
): Promise<ListResponse<AgentRunDTO>> {
  return get<ListResponse<AgentRunDTO>>("/v1/admin/agent-runs", { params });
}

// POST /v1/admin/agent-runs/:id/cancel — force-cancel a running agent run (M-C3b)
export function cancelAgentRunApi(id: number): Promise<void> {
  return post<void>(`/v1/admin/agent-runs/${id}/cancel`);
}

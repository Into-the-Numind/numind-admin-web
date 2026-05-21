// Admin monitoring types — user-facing agent builder types moved to
// numind-web-v3/src/types/agentBuilder.ts per feature
// agent-mode-configurator-relocate (2026-05-22).
//
// Backend source: numind-server/internal/pkg/model/agent_run.go

// ============================================================
// API Response wrapper
// ============================================================

export interface ListResponse<T> {
  list: T[];
  total: number;
}

// ============================================================
// AgentRunDTO — admin monitoring (GET /v1/admin/agent-runs)
// Mirrors backend model.AgentRun (json tags)
// ============================================================

export interface AgentRunDTO {
  id: number;
  user_id: number;
  agent_definition_id: number;
  agent_name?: string; // joined from agent_definition if backend exposes
  status: "running" | "terminated" | "cancelling" | "cancelled";
  terminal_reason?: string;
  trace_id?: string;
  cancellation_requested_at?: string | null;
  created_at: string; // ISO 8601
  ended_at?: string | null;
  duration_ms?: number; // computed client-side if not returned by backend
}

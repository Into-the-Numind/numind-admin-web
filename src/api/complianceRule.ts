// API wrappers for /v1/admin/compliance-rules (5 endpoints, admin_token middleware).
// Backend: numind-server feature agent-e2e-rollout Phase C compliance endpoints.

import { get, post, patch, del } from "./request";
import type {
  ComplianceRule,
  CreateRuleRequest,
  PatchRuleRequest,
  ListRulesParams,
  ListRulesResponse,
} from "@/types/compliance";

// 1. GET    /v1/admin/compliance-rules              — List with filters
export function listComplianceRules(
  params: ListRulesParams = {},
): Promise<ListRulesResponse> {
  return get<ListRulesResponse>("/v1/admin/compliance-rules", { params });
}

// 2. POST   /v1/admin/compliance-rules              — Create
export function createComplianceRule(
  data: CreateRuleRequest,
): Promise<ComplianceRule> {
  return post<ComplianceRule>("/v1/admin/compliance-rules", data);
}

// 3. GET    /v1/admin/compliance-rules/:id          — Get one
export function getComplianceRule(id: number): Promise<ComplianceRule> {
  return get<ComplianceRule>(`/v1/admin/compliance-rules/${id}`);
}

// 4. PATCH  /v1/admin/compliance-rules/:id          — Partial update
export function patchComplianceRule(
  id: number,
  data: PatchRuleRequest,
): Promise<ComplianceRule> {
  return patch<ComplianceRule>(`/v1/admin/compliance-rules/${id}`, data);
}

// 5. DELETE /v1/admin/compliance-rules/:id          — Delete
export function deleteComplianceRule(id: number): Promise<void> {
  return del<void>(`/v1/admin/compliance-rules/${id}`);
}

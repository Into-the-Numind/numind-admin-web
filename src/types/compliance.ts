// Compliance rule types — mirrors backend model.ComplianceRule (json tags)
// Backend: numind-server feature agent-e2e-rollout Phase C endpoints
// /v1/admin/compliance-rules

export type RuleType =
  | "forbid_brand"
  | "forbid_phrase"
  | "scope_filter"
  | "topic_classification";

export const RULE_TYPE_LABELS: Record<RuleType, string> = {
  forbid_brand: "禁止品牌",
  forbid_phrase: "禁止短语",
  scope_filter: "范围过滤",
  topic_classification: "话题分类",
};

export interface ComplianceRule {
  id: number;
  parent_user_id: number;
  rule_type: RuleType;
  pattern: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRuleRequest {
  parent_user_id: number;
  rule_type: RuleType;
  pattern: string;
  // null triggers default:true behaviour workaround on backend (GORM gotcha)
  is_active?: boolean | null;
}

export interface PatchRuleRequest {
  rule_type?: RuleType;
  pattern?: string;
  // null signals explicit false to work around GORM default:true bool gotcha
  is_active?: boolean | null;
}

export interface ListRulesParams {
  page?: number;
  page_size?: number;
  parent_user_id?: number;
  rule_type?: RuleType;
  is_active?: boolean;
}

export interface ListRulesResponse {
  list: ComplianceRule[];
  total: number;
}

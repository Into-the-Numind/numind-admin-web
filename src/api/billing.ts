import { get, post, put, del } from "./request";

// ====== Types ======

export interface BillingOverview {
  today_cost_cents: number;
  month_cost_cents: number;
  total_cost_cents: number;
  today_revenue_cents: number;
  month_revenue_cents: number;
  total_revenue_cents: number;
  today_call_count: number;
  month_call_count: number;
  total_call_count: number;
  by_service_type: ServiceTypeStat[];
  by_operation: OperationStat[];
  by_provider: ProviderStat[];
}

export interface ServiceTypeStat {
  service_type: string;
  call_count: number;
  cost_cents: number;
  revenue_cents: number;
  total_tokens: number;
}

export interface OperationStat {
  operation: string;
  call_count: number;
  cost_cents: number;
  revenue_cents: number;
}

export interface ProviderStat {
  provider: string;
  call_count: number;
  cost_cents: number;
  revenue_cents: number;
}

export interface UsageRecord {
  id: number;
  user_id: number;
  service_type: string;
  provider: string;
  model: string;
  operation: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  reasoning_tokens: number;
  bytes_uploaded: number;
  item_count: number;
  cost_cents: number;
  revenue_cents: number;
  biz_ref_type: string;
  biz_ref_id: number;
  is_fallback: boolean;
  created_at: string;
}

export interface UsageRecordListParams {
  offset?: number;
  limit?: number;
  user_id?: number;
  service_type?: string;
  provider?: string;
  operation?: string;
  date_from?: string;
  date_to?: string;
}

export interface UsageRecordListResponse {
  total: number;
  total_pages: number;
  records: UsageRecord[];
}

export interface UserConsumption {
  user_id: number;
  username: string;
  nickname: string;
  cost_cents: number;
  call_count: number;
}

export interface UserConsumptionParams {
  offset?: number;
  limit?: number;
  period?: "month" | "all";
}

export interface UserConsumptionResponse {
  total: number;
  total_pages: number;
  users: UserConsumption[];
}

export interface PricingRule {
  id: number;
  service_type: string;
  provider: string;
  model: string;
  billing_mode: string;
  input_price_per_mtok: number;
  output_price_per_mtok: number;
  price_per_call: number;
  price_per_gb: number;
  sell_input_price_per_mtok: number;
  sell_output_price_per_mtok: number;
  sell_price_per_call: number;
  sell_price_per_gb: number;
  credit_multiplier: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PricingRuleListResponse {
  total: number;
  total_pages: number;
  rules: PricingRule[];
}

export interface CreatePricingRuleRequest {
  service_type: string;
  provider: string;
  model?: string;
  billing_mode?: string; // flat | tiered_token
  input_price_per_mtok?: number;
  output_price_per_mtok?: number;
  price_per_call?: number;
  price_per_gb?: number;
  sell_input_price_per_mtok?: number;
  sell_output_price_per_mtok?: number;
  sell_price_per_call?: number;
  sell_price_per_gb?: number;
  credit_multiplier?: number;
  is_active?: boolean;
}

export interface UpdatePricingRuleRequest {
  service_type?: string;
  provider?: string;
  model?: string;
  billing_mode?: string; // flat | tiered_token
  input_price_per_mtok?: number;
  output_price_per_mtok?: number;
  price_per_call?: number;
  price_per_gb?: number;
  sell_input_price_per_mtok?: number;
  sell_output_price_per_mtok?: number;
  sell_price_per_call?: number;
  sell_price_per_gb?: number;
  credit_multiplier?: number;
  is_active?: boolean;
}

// ====== API Functions ======

export function getBillingOverviewApi() {
  return get<BillingOverview>("/v1/admin/billing/overview");
}

export function getUsageRecordsApi(params: UsageRecordListParams) {
  return get<UsageRecordListResponse>("/v1/admin/billing/records", { params });
}

export function getUserConsumptionApi(params: UserConsumptionParams) {
  return get<UserConsumptionResponse>("/v1/admin/billing/users", { params });
}

export function getPricingRulesApi(params: {
  offset?: number;
  limit?: number;
}) {
  return get<PricingRuleListResponse>("/v1/admin/billing/pricing-rules", {
    params,
  });
}

export function createPricingRuleApi(data: CreatePricingRuleRequest) {
  return post<PricingRule>("/v1/admin/billing/pricing-rules", data);
}

export function updatePricingRuleApi(
  id: number,
  data: UpdatePricingRuleRequest,
) {
  return put<void>(`/v1/admin/billing/pricing-rules/${id}`, data);
}

export function deletePricingRuleApi(id: number) {
  return del<void>(`/v1/admin/billing/pricing-rules/${id}`);
}

// ====== Pricing Rule Tiers ======

export interface PricingRuleTier {
  id: number;
  rule_id: number;
  token_type: "input" | "output";
  min_tokens: number;
  max_tokens: number | null;
  cost_per_mtok: number;
  sell_per_mtok: number;
}

export interface TierInput {
  token_type: "input" | "output";
  min_tokens: number;
  max_tokens: number | null;
  cost_per_mtok: number;
  sell_per_mtok: number;
}

export function getTiersApi(ruleId: number): Promise<PricingRuleTier[]> {
  return get<PricingRuleTier[]>(
    `/v1/admin/billing/pricing-rules/${ruleId}/tiers`,
  );
}

export function replaceTiersApi(
  ruleId: number,
  tiers: TierInput[],
): Promise<void> {
  return put<void>(`/v1/admin/billing/pricing-rules/${ruleId}/tiers`, {
    tiers,
  });
}

// ====== Analytics ======

export interface AnalyticsBucket {
  bucket: string;
  count: number;
}

export interface AnalyticsUserDetail {
  user_id: number;
  period_tokens: number;
  period_cost_cents: number;
}

export interface AnalyticsTopUser {
  user_id: number;
  nickname: string;
  period_runs: number;
  period_tokens: number;
  period_cost_cents: number;
}

export interface AnalyticsModelStat {
  model: string;
  token_share_pct: number;
  period_cost_cents: number;
}

export interface AnalyticsSummary {
  active_users: number;
  total_runs: number;
  days_in_range: number;
  avg_tokens_per_run: number;
  p50_tokens_per_run: number;
  p90_tokens_per_run: number;
  p95_tokens_per_run: number;
  p50_cost_cents_per_user: number;
  p90_cost_cents_per_user: number;
  p95_cost_cents_per_user: number;
}

export interface AnalyticsResponse {
  summary: AnalyticsSummary;
  run_distribution: AnalyticsBucket[];
  user_distribution: AnalyticsBucket[];
  user_details: AnalyticsUserDetail[];
  model_breakdown: AnalyticsModelStat[];
  top_users: AnalyticsTopUser[];
}

export function getAnalyticsApi(
  from: string,
  to: string,
): Promise<AnalyticsResponse> {
  return get<AnalyticsResponse>("/v1/admin/billing/analytics", {
    params: { from, to },
  });
}

export function recalculateApi(
  from: string,
  to: string,
  dryRun: boolean,
): Promise<{
  affected_records: number;
  old_total_cost_cents: number;
  new_total_cost_cents: number;
  delta_cents: number;
  dry_run: boolean;
}> {
  return post<{
    affected_records: number;
    old_total_cost_cents: number;
    new_total_cost_cents: number;
    delta_cents: number;
    dry_run: boolean;
  }>("/v1/admin/billing/recalculate", { from, to, dry_run: dryRun });
}

// ====== Tier Change Logs ======

export interface TierChangeLogItem {
  id: number;
  parent_user_id: number;
  parent_nickname: string;
  sub_user_id: number;
  sub_nickname: string;
  old_tier: string;
  new_tier: string;
  months: number;
  old_tier_expires: string | null;
  new_tier_expires: string;
  created_at: string;
}

export interface TierChangeLogsResponse {
  total: number;
  items: TierChangeLogItem[];
}

export interface TierChangeStatsResponse {
  total_changes: number;
  upgrades: number;
  downgrades: number;
  tier_breakdown: { new_tier: string; count: number; total_months: number }[];
}

export function getTierChangeLogsApi(params: {
  from?: string;
  to?: string;
  offset?: number;
  limit?: number;
}): Promise<TierChangeLogsResponse> {
  return get<TierChangeLogsResponse>("/v1/admin/billing/tier-changes", {
    params,
  });
}

export function getTierChangeStatsApi(
  from: string,
  to: string,
): Promise<TierChangeStatsResponse> {
  return get<TierChangeStatsResponse>("/v1/admin/billing/tier-changes/stats", {
    params: { from, to },
  });
}

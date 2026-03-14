import { get, post, put, del } from './request'

// ====== Types ======

export interface BillingOverview {
  today_cost_cents: number
  month_cost_cents: number
  total_cost_cents: number
  today_revenue_cents: number
  month_revenue_cents: number
  total_revenue_cents: number
  today_call_count: number
  month_call_count: number
  total_call_count: number
  by_service_type: ServiceTypeStat[]
  by_operation: OperationStat[]
  by_provider: ProviderStat[]
}

export interface ServiceTypeStat {
  service_type: string
  call_count: number
  cost_cents: number
  revenue_cents: number
  total_tokens: number
}

export interface OperationStat {
  operation: string
  call_count: number
  cost_cents: number
  revenue_cents: number
}

export interface ProviderStat {
  provider: string
  call_count: number
  cost_cents: number
  revenue_cents: number
}

export interface UsageRecord {
  id: number
  user_id: number
  service_type: string
  provider: string
  model: string
  operation: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  reasoning_tokens: number
  bytes_uploaded: number
  item_count: number
  cost_cents: number
  revenue_cents: number
  biz_ref_type: string
  biz_ref_id: number
  is_fallback: boolean
  created_at: string
}

export interface UsageRecordListParams {
  offset?: number
  limit?: number
  user_id?: number
  service_type?: string
  provider?: string
  operation?: string
  date_from?: string
  date_to?: string
}

export interface UsageRecordListResponse {
  total: number
  total_pages: number
  records: UsageRecord[]
}

export interface UserConsumption {
  user_id: number
  username: string
  nickname: string
  cost_cents: number
  call_count: number
}

export interface UserConsumptionParams {
  offset?: number
  limit?: number
  period?: 'month' | 'all'
}

export interface UserConsumptionResponse {
  total: number
  total_pages: number
  users: UserConsumption[]
}

export interface PricingRule {
  id: number
  service_type: string
  provider: string
  model: string
  input_price_per_mtok: number
  output_price_per_mtok: number
  price_per_call: number
  price_per_gb: number
  sell_input_price_per_mtok: number
  sell_output_price_per_mtok: number
  sell_price_per_call: number
  sell_price_per_gb: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PricingRuleListResponse {
  total: number
  total_pages: number
  rules: PricingRule[]
}

export interface CreatePricingRuleRequest {
  service_type: string
  provider: string
  model?: string
  input_price_per_mtok?: number
  output_price_per_mtok?: number
  price_per_call?: number
  price_per_gb?: number
  sell_input_price_per_mtok?: number
  sell_output_price_per_mtok?: number
  sell_price_per_call?: number
  sell_price_per_gb?: number
  is_active?: boolean
}

export interface UpdatePricingRuleRequest {
  service_type?: string
  provider?: string
  model?: string
  input_price_per_mtok?: number
  output_price_per_mtok?: number
  price_per_call?: number
  price_per_gb?: number
  sell_input_price_per_mtok?: number
  sell_output_price_per_mtok?: number
  sell_price_per_call?: number
  sell_price_per_gb?: number
  is_active?: boolean
}

// ====== API Functions ======

export function getBillingOverviewApi() {
  return get<BillingOverview>('/v1/admin/billing/overview')
}

export function getUsageRecordsApi(params: UsageRecordListParams) {
  return get<UsageRecordListResponse>('/v1/admin/billing/records', { params })
}

export function getUserConsumptionApi(params: UserConsumptionParams) {
  return get<UserConsumptionResponse>('/v1/admin/billing/users', { params })
}

export function getPricingRulesApi(params: { offset?: number; limit?: number }) {
  return get<PricingRuleListResponse>('/v1/admin/billing/pricing-rules', { params })
}

export function createPricingRuleApi(data: CreatePricingRuleRequest) {
  return post<PricingRule>('/v1/admin/billing/pricing-rules', data)
}

export function updatePricingRuleApi(id: number, data: UpdatePricingRuleRequest) {
  return put<void>(`/v1/admin/billing/pricing-rules/${id}`, data)
}

export function deletePricingRuleApi(id: number) {
  return del<void>(`/v1/admin/billing/pricing-rules/${id}`)
}

// ====== Capability Schema ======

export type CapabilityFieldType =
  | "modalities"
  | "string_list"
  | "int"
  | "bool"
  | "feature_map";

export interface CapabilityField {
  name: string;
  type: CapabilityFieldType;
  required: boolean;
  enum_values?: string[];
  description: string;
}

export interface CapabilitySchema {
  service_type: string;
  fields: CapabilityField[];
}

export type CapabilitySchemaMap = Record<string, CapabilitySchema>;

// ====== AI Service ======

// RouteDTO is the canonical route shape returned by all route CRUD endpoints.
// Pricing fields are intentionally absent — they live in pricing_rule.
// Legacy AIServiceRoute (with 5 pricing fields) was removed in T3 review;
// T-arch dropped pricing from the backend DTO struct.
export interface RouteDTO {
  id: number;
  service_id: number;
  provider_id: number;
  provider_name: string;
  provider_model_id: string;
  priority: number;
  is_active: boolean;
  created_at?: string; // omitted by backend slim DTO
  updated_at?: string; // omitted by backend slim DTO
}

export interface CreateRouteRequest {
  provider_id: number;
  provider_model_id: string;
  priority?: number;
  is_active?: boolean;
}

export interface UpdateRouteRequest {
  provider_model_id?: string;
  priority?: number;
  is_active?: boolean;
}

export interface AIService {
  id: number;
  model_key: string;
  display_name: string;
  service_type: string;
  capability_json?: Record<string, unknown>;
  latency_tier: string;
  quality_tier: string;
  tags?: string[];
  deprecated_at?: string | null;
  is_thinking: boolean;
  base_model_id?: number | null;
  supports_thinking: boolean;
  thinking_only: boolean;
  icon: string;
  sort_order: number;
  is_active: boolean;
  // route_count is populated by the list endpoint so the UI can flag services
  // with zero active routes (orphan Services, the SalesRAG incident root cause).
  // Detail endpoint populates routes[] instead; this field may be undefined there.
  route_count?: number;
  created_at: string;
  updated_at: string;
}

export interface AIServiceDetail extends AIService {
  routes: RouteDTO[];
}

export interface CreateServiceRequest {
  model_key: string;
  display_name: string;
  service_type: string;
  capability_json?: Record<string, unknown>;
  latency_tier?: string;
  quality_tier?: string;
  tags?: string[];
  is_thinking?: boolean;
  supports_thinking?: boolean;
  thinking_only?: boolean;
  icon?: string;
  sort_order?: number;
  is_active?: boolean;
}

export type UpdateServiceRequest = Partial<CreateServiceRequest>;

// Atomic Service+Route creation — backed by POST /v1/admin/ai/services-with-route.
// Used by the create-service flow to guarantee a Route exists before the Service
// is persisted, closing the orphan-Service hole that caused the SalesRAG incident.
export interface CreateServiceWithRouteRequest {
  service: CreateServiceRequest;
  route: CreateRouteRequest;
}

export interface CreateServiceWithRouteResponse {
  service: AIService;
  route: RouteDTO;
}

// ====== Task Profile ======

export interface TaskProfile {
  id: number;
  task_id: string;
  display_name: string;
  description: string;
  service_type: string;
  requirements?: Record<string, unknown>;
  default_service_id?: number | null;
  user_selectable: boolean;
  extra_metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  fallback_count?: number;
  allowed_count?: number;
}

export interface TaskDetailResponse extends TaskProfile {
  default_service: AIService | null;
  fallbacks: AIService[];
  allowed: AIService[];
}

export interface UpdateTaskRequest {
  requirements?: Record<string, unknown>;
  default_service_id?: number | null;
  fallback_service_ids?: number[];
  allowed_service_ids?: number[];
  reason?: string;
}

export interface IncompatibleBinding {
  role: string;
  service_id: number;
  service_name: string;
  reasons: string[];
}

export interface UpdateTaskResponse {
  compatible: boolean;
  incompatible_bindings?: IncompatibleBinding[];
}

export interface MatchResult {
  compatible: boolean;
  reasons: string[];
  task_requirements?: Record<string, unknown>;
  service_capabilities?: Record<string, unknown>;
}

// ====== AI Provider ======

export interface ProviderDTO {
  id: number;
  name: string;
  display_name: string;
  base_url: string;
  api_key: string; // always MaskedAPIKey output, e.g. "****abcd"
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProviderRequest {
  name: string;
  display_name: string;
  base_url: string;
  api_key: string;
  is_active?: boolean;
}

export interface UpdateProviderRequest {
  display_name?: string;
  base_url?: string;
  api_key?: string; // null/empty = preserve existing
  is_active?: boolean;
}

export interface TestConnectionResult {
  success: boolean;
  latency_ms?: number;
  error?: string;
  http_status?: number;
}

// ====== Context Budget ======

export interface TokenProfile {
  id: number;
  provider: string;
  model: string;
  model_family: string;
  service_type: string;
  profile_json: Record<string, unknown>;
  safety_multiplier: number;
  calibration_multiplier: number;
  calibration_sample_count: number;
  calibration_p50_abs_error: number;
  calibration_p90_abs_error: number;
  calibration_p99_under_ratio: number;
  version: number;
  is_active: boolean;
  is_fallback: boolean;
  updated_by: string;
  updated_at: string;
  created_at?: string;
}

export interface CreateTokenProfileRequest {
  provider: string;
  model: string;
  model_family?: string;
  service_type: string;
  safety_multiplier?: number;
  calibration_multiplier?: number;
  profile_json?: Record<string, unknown>;
}

export type UpdateTokenProfileRequest = Partial<CreateTokenProfileRequest>;

export interface ContextBudgetPolicy {
  id: number;
  operation: string;
  fixed_overhead_tokens: number;
  reserved_output_tokens: number;
  safe_ratio: number;
  version: number;
  is_active: boolean;
  updated_by: string;
  updated_at: string;
  created_at?: string;
}

export interface UpdateContextBudgetPolicyRequest {
  fixed_overhead_tokens?: number;
  reserved_output_tokens?: number;
  safe_ratio?: number;
}

export interface ContextBudgetEvent {
  id: number;
  user_id?: number;
  operation: string;
  task_id?: string;
  provider: string;
  model: string;
  context_window: number;
  max_output_tokens: number;
  reserved_output_tokens: number;
  fixed_overhead_tokens: number;
  safe_ratio: number;
  safe_input_budget: number;
  estimated_before: number;
  estimated_after: number;
  actual_prompt_tokens?: number;
  actual_completion_tokens?: number;
  reserve_amount?: number;
  reconcile_delta?: number;
  dropped_fragment_count: number;
  summarized_fragment_count: number;
  critical_fragment_count: number;
  token_profile_id?: number;
  budget_policy_id?: number;
  status: "ok" | "compressed" | "failed" | "skipped";
  error_code?: string;
  created_at: string;
}

export interface PreviewContextBudgetRequest {
  service_id: number;
  operation: string;
  fixed_overhead_tokens: number;
  reserved_output_tokens: number;
  safe_ratio: number;
}

export interface PreviewContextBudgetResponse {
  context_window: number;
  max_output_tokens: number;
  reserved_output_tokens: number;
  safe_input_budget: number;
  valid: boolean;
  warnings: string[];
}

// ====== Audit Log ======

export interface AuditLogDiff {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface AuditLog {
  id: number;
  actor: string;
  action: string;
  target_type: string;
  target_id: string;
  target_name?: string;
  diff?: AuditLogDiff;
  reason?: string;
  created_at: string;
}

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

export interface AIServiceRoute {
  id: number;
  provider_id: number;
  provider_name: string;
  provider_model_id: string;
  priority: number;
  pricing_unit: string;
  input_price_per_mtok: number;
  output_price_per_mtok: number;
  price_per_call?: number;
  price_per_second?: number;
  is_active: boolean;
}

// RouteDTO is the shape returned by route CRUD endpoints (Wave 1 backend).
// Pricing fields are intentionally absent — they live in pricing_rule.
export interface RouteDTO {
  id: number;
  service_id: number;
  provider_id: number;
  provider_name: string;
  provider_model_id: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
}

export interface AIServiceDetail extends AIService {
  routes: AIServiceRoute[];
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

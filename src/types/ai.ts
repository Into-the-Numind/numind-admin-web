// ====== Capability Schema ======

export interface CapabilityField {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "select";
  required?: boolean;
  options?: string[];
  description?: string;
}

export interface CapabilityDefinition {
  name: string;
  label: string;
  required_fields: CapabilityField[];
  optional_fields?: CapabilityField[];
}

export type CapabilitySchema = Record<string, CapabilityDefinition>;

// ====== AI Service ======

export interface AIServiceRoute {
  environment: string;
  endpoint: string;
  api_key_masked?: string;
  extra_params?: Record<string, unknown>;
}

export interface AIService {
  id: number;
  name: string;
  display_name: string;
  service_type: string;
  provider: string;
  model_id: string;
  capabilities: string[];
  routes: AIServiceRoute[];
  is_active: boolean;
  is_deleted: boolean;
  meta?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateServiceRequest {
  name: string;
  display_name: string;
  service_type: string;
  provider: string;
  model_id: string;
  capabilities: string[];
  routes: AIServiceRoute[];
  meta?: Record<string, unknown>;
}

export type UpdateServiceRequest = Partial<CreateServiceRequest> & {
  is_active?: boolean;
};

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

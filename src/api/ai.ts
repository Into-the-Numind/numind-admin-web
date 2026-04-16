import { get, post, put, del } from "./request";
import type {
  AIService,
  CreateServiceRequest,
  UpdateServiceRequest,
  TaskProfile,
  TaskBinding,
  CapabilitySchema,
  MatchResult,
  AuditLog,
} from "@/types/ai";

// ====== AI Services ======

export const listServicesApi = (params?: {
  page?: number;
  page_size?: number;
  service_type?: string;
  status?: string;
}) =>
  get<{ list: AIService[]; total: number }>("/v1/admin/ai/services", {
    params,
  });

export const getServiceApi = (id: number) =>
  get<AIService>(`/v1/admin/ai/services/${id}`);

export const createServiceApi = (data: CreateServiceRequest) =>
  post<AIService>("/v1/admin/ai/services", data);

export const updateServiceApi = (id: number, data: UpdateServiceRequest) =>
  put<AIService>(`/v1/admin/ai/services/${id}`, data);

export const deleteServiceApi = (id: number) =>
  del<null>(`/v1/admin/ai/services/${id}`);

export const restoreServiceApi = (id: number) =>
  post<AIService>(`/v1/admin/ai/services/${id}/restore`);

// ====== Task Profiles ======

export const listTasksApi = (params?: { page?: number; page_size?: number }) =>
  get<{ list: TaskProfile[]; total: number }>("/v1/admin/ai/tasks", { params });

export const getTaskApi = (taskKey: string) =>
  get<TaskProfile>(`/v1/admin/ai/tasks/${taskKey}`);

export const updateTaskApi = (
  taskKey: string,
  data: {
    binding: TaskBinding;
    override_reason?: string;
  },
) => put<TaskProfile>(`/v1/admin/ai/tasks/${taskKey}`, data);

export const validateAgainstApi = (taskKey: string, serviceId: number) =>
  post<MatchResult>(`/v1/admin/ai/tasks/${taskKey}/validate-against`, {
    service_id: serviceId,
  });

// ====== Capability Schema ======

export const getCapabilitySchemaApi = () =>
  get<CapabilitySchema>("/v1/admin/ai/capability-schema");

// ====== Audit Logs ======

export const listAuditLogsApi = (params?: {
  page?: number;
  page_size?: number;
  actor?: string;
  target_type?: string;
  date_from?: string;
  date_to?: string;
}) =>
  get<{ list: AuditLog[]; total: number }>("/v1/admin/ai/audit-logs", {
    params,
  });

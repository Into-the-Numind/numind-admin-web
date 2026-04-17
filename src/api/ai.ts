import { get, post, put, del } from "./request";
import type {
  AIService,
  CreateServiceRequest,
  UpdateServiceRequest,
  TaskProfile,
  TaskDetailResponse,
  UpdateTaskRequest,
  UpdateTaskResponse,
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

export const getTaskApi = (taskId: string) =>
  get<TaskDetailResponse>(`/v1/admin/ai/tasks/${taskId}`);

export const updateTaskApi = (
  taskId: string,
  data: UpdateTaskRequest,
  force = false,
) =>
  put<UpdateTaskResponse>(
    `/v1/admin/ai/tasks/${taskId}${force ? "?force=true" : ""}`,
    data,
  );

export const validateAgainstApi = (taskKey: string, serviceId: number) =>
  post<MatchResult>(
    `/v1/admin/ai/services/${serviceId}/validate-against/${taskKey}`,
  );

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

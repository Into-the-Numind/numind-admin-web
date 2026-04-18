import { get, post, put, del } from "./request";
import type {
  AIService,
  AIServiceDetail,
  CreateServiceRequest,
  UpdateServiceRequest,
  TaskProfile,
  TaskDetailResponse,
  UpdateTaskRequest,
  UpdateTaskResponse,
  CapabilitySchemaMap,
  MatchResult,
  AuditLog,
  ProviderDTO,
  CreateProviderRequest,
  UpdateProviderRequest,
  TestConnectionResult,
  RouteDTO,
  CreateRouteRequest,
  UpdateRouteRequest,
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
  get<AIServiceDetail>(`/v1/admin/ai/services/${id}`);

export const createServiceApi = (data: CreateServiceRequest) =>
  post<AIService>("/v1/admin/ai/services", data);

export const updateServiceApi = (id: number, data: UpdateServiceRequest) =>
  put<null>(`/v1/admin/ai/services/${id}`, data);

export const deleteServiceApi = (id: number, reason?: string) =>
  del<null>(`/v1/admin/ai/services/${id}`, { data: reason ? { reason } : {} });

export const restoreServiceApi = (id: number, reason: string) =>
  post<null>(`/v1/admin/ai/services/${id}/restore`, { reason });

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
  get<CapabilitySchemaMap>("/v1/admin/ai/capability-schema");

// ====== Routes ======

export const createRouteApi = (serviceId: number, data: CreateRouteRequest) =>
  post<{ route: RouteDTO; warnings?: string[] }>(
    `/v1/admin/ai/services/${serviceId}/routes`,
    data,
  );

export const updateRouteApi = (routeId: number, data: UpdateRouteRequest) =>
  put<{ route: RouteDTO; warnings?: string[] }>(
    `/v1/admin/ai/routes/${routeId}`,
    data,
  );

export const deleteRouteApi = (routeId: number) =>
  del<null>(`/v1/admin/ai/routes/${routeId}`);

export const toggleRouteApi = (routeId: number) =>
  post<{ route: RouteDTO }>(`/v1/admin/ai/routes/${routeId}/toggle`, {});

// ====== AI Providers ======

export const listProvidersApi = () =>
  get<{ list: ProviderDTO[]; total: number }>(`/v1/admin/ai/providers`);

export const getProviderApi = (id: number) =>
  get<ProviderDTO>(`/v1/admin/ai/providers/${id}`);

export const createProviderApi = (data: CreateProviderRequest) =>
  post<ProviderDTO>(`/v1/admin/ai/providers`, data);

export const updateProviderApi = (id: number, data: UpdateProviderRequest) =>
  put<ProviderDTO>(`/v1/admin/ai/providers/${id}`, data);

export const deleteProviderApi = (id: number) =>
  del<null>(`/v1/admin/ai/providers/${id}`);

export const testProviderConnectionApi = (id: number) =>
  post<TestConnectionResult>(
    `/v1/admin/ai/providers/${id}/test-connection`,
    {},
  );

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

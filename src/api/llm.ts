import { get, post, put, del } from "./request";

// ====== Types ======

export interface LLMProvider {
  id: number;
  name: string;
  display_name: string;
  base_url: string;
  api_key_masked: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LLMModel {
  id: number;
  model_key: string;
  display_name: string;
  is_thinking: boolean;
  base_model_id: number | null;
  supports_thinking: boolean;
  thinking_only: boolean;
  icon: string;
  sort_order: number;
  is_active: boolean;
}

export interface LLMModelRoute {
  id: number;
  model_id: number;
  provider_id: number;
  provider_model_id: string;
  priority: number;
  input_price_per_mtok: number;
  output_price_per_mtok: number;
  is_active: boolean;
  provider?: LLMProvider;
}

// ====== Provider CRUD ======

export const getProvidersApi = (page = 1, pageSize = 20) =>
  get<{ list: LLMProvider[]; total: number }>("/v1/admin/llm/providers", {
    params: { page, page_size: pageSize },
  });

export const createProviderApi = (data: {
  name: string;
  display_name: string;
  base_url: string;
  api_key: string;
}) => post<LLMProvider>("/v1/admin/llm/providers", data);

export const updateProviderApi = (
  id: number,
  data: Partial<{
    display_name: string;
    base_url: string;
    api_key: string;
    is_active: boolean;
  }>,
) => put<LLMProvider>(`/v1/admin/llm/providers/${id}`, data);

export const deleteProviderApi = (id: number) =>
  del<null>(`/v1/admin/llm/providers/${id}`);

// ====== Model CRUD ======

export const getModelsApi = (page = 1, pageSize = 50) =>
  get<{ list: LLMModel[]; total: number }>("/v1/admin/llm/models", {
    params: { page, page_size: pageSize },
  });

export const createModelApi = (data: Partial<LLMModel>) =>
  post<LLMModel>("/v1/admin/llm/models", data);

export const updateModelApi = (id: number, data: Partial<LLMModel>) =>
  put<LLMModel>(`/v1/admin/llm/models/${id}`, data);

export const deleteModelApi = (id: number) =>
  del<null>(`/v1/admin/llm/models/${id}`);

// ====== Route CRUD ======

export const getRoutesApi = (modelId: number) =>
  get<{ list: LLMModelRoute[]; total: number }>(
    `/v1/admin/llm/models/${modelId}/routes`,
  );

export const createRouteApi = (modelId: number, data: Partial<LLMModelRoute>) =>
  post<LLMModelRoute>(`/v1/admin/llm/models/${modelId}/routes`, data);

export const updateRouteApi = (
  modelId: number,
  routeId: number,
  data: Partial<LLMModelRoute>,
) =>
  put<LLMModelRoute>(`/v1/admin/llm/models/${modelId}/routes/${routeId}`, data);

export const deleteRouteApi = (modelId: number, routeId: number) =>
  del<null>(`/v1/admin/llm/models/${modelId}/routes/${routeId}`);

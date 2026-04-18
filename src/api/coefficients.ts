import request from "./request";

// Admin-only: R2 estimation coefficient management
// See spec: numind-server/docs/superpowers/specs/2026-04-18-credits-system-design.md §4.1.2

export interface EstimationCoefficient {
  id: number;
  provider: string;
  model: string;
  operation: string;
  char_to_token_ratio: number;
  completion_prompt_ratio: number;
  safety_buffer_pct: number;
  version: number;
  is_active: boolean;
  change_reason?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ListCoefficientsReq {
  page?: number;
  page_size?: number;
  provider?: string;
  model?: string;
  operation?: string;
  is_active?: "1" | "all"; // default: '1'
}

export interface ListCoefficientsResp {
  list: EstimationCoefficient[];
  total: number;
}

export interface UpdateCoefficientReq {
  provider: string;
  model: string;
  operation: string;
  char_to_token_ratio: number;
  completion_prompt_ratio: number;
  safety_buffer_pct: number;
  change_reason: string;
}

export function listCoefficients(params: ListCoefficientsReq) {
  return request.get<ListCoefficientsResp>(
    "/v1/admin/estimation-coefficients",
    { params },
  );
}

export function listCoefficientHistory(params: {
  provider: string;
  model: string;
  operation: string;
}) {
  return request.get<{ list: EstimationCoefficient[] }>(
    "/v1/admin/estimation-coefficients/history",
    { params },
  );
}

export function createCoefficient(body: UpdateCoefficientReq) {
  return request.post<EstimationCoefficient>(
    "/v1/admin/estimation-coefficients",
    body,
  );
}

export function updateCoefficient(id: number, body: UpdateCoefficientReq) {
  return request.put<EstimationCoefficient>(
    `/v1/admin/estimation-coefficients/${id}`,
    body,
  );
}

export function deleteCoefficient(id: number) {
  return request.delete<void>(`/v1/admin/estimation-coefficients/${id}`);
}

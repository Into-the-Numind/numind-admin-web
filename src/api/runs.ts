import { get } from "./request";

export interface SopRun {
  id: number;
  template_id: number;
  user_id: number;
  status: string;
  started_at: string;
  finished_at: string;
  error_message: string;
  created_at: string;
  // 后端 omitempty 省略 nil 关联（template/user 被 soft-delete 时），所以是可选字段。
  // RunsView.vue 用 run.template?.name / run.user?.nickname 访问。
  template?: { id: number; name: string };
  user?: { id: number; nickname: string };
  total_tokens?: number;
  cost_cents?: number;
}

export interface RunsResponse {
  total: number;
  runs: SopRun[];
}

export interface NodeRun {
  id: number;
  node_id: number;
  status: string;
  input: string;
  output: string;
  thinking: string;
  latency_ms: number;
  sort: number;
}

export interface RunDetailResponse {
  run: SopRun;
  node_runs: NodeRun[];
}

export interface RunListParams {
  offset?: number;
  limit?: number;
  user_id?: number;
  status?: string;
  template_id?: number;
}

export function getRunsApi(params: RunListParams) {
  return get<RunsResponse>("/v1/admin/sop/runs", { params });
}

export function getRunApi(id: number) {
  return get<SopRun>(`/v1/admin/sop/runs/${id}`);
}

export function getRunDetailApi(id: number) {
  return get<RunDetailResponse>(`/v1/admin/sop/runs/${id}/detail`);
}

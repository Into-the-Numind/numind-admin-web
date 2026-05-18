/**
 * Mock handlers for credits-system admin endpoints that are not yet implemented
 * on the backend (Track F dispatch precedes Phase 2 integration).
 *
 * ### Why not MSW?
 * The admin-web repo has no MSW dependency. Rather than pulling in MSW + service
 * worker plumbing for a handful of dev-only endpoints, we register a lightweight
 * axios adapter that intercepts matching URLs and returns canned responses.
 *
 * ### Activation
 * Enabled only when `VITE_USE_ADMIN_MOCKS=1` at build/dev time. In all other
 * environments, requests fall through to the real backend unchanged.
 *
 * Endpoints handled (see spec 2026-04-18-credits-system-design.md §4.4):
 *   - GET    /v1/admin/estimation-coefficients
 *   - GET    /v1/admin/estimation-coefficients/history
 *   - POST   /v1/admin/estimation-coefficients
 *   - PUT    /v1/admin/estimation-coefficients/:id
 *   - DELETE /v1/admin/estimation-coefficients/:id
 *
 * Responses follow the project's standard `core.WriteResponse` envelope
 * `{ code: 0, message: 'ok', data: ... }` so the existing axios interceptor in
 * `src/api/request.ts` unwraps `.data` automatically.
 */
import type {
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import type {
  EstimationCoefficient,
  ListCoefficientsResp,
  UpdateCoefficientReq,
} from "@/api/coefficients";

// ---- In-memory store ----

interface MockState {
  coefficients: EstimationCoefficient[];
  nextCoefId: number;
}

function seedCoefficients(): EstimationCoefficient[] {
  const now = new Date().toISOString();
  return [
    {
      id: 1,
      provider: "volc",
      model: "glm-4-7-251222",
      operation: "sop_step",
      char_to_token_ratio: 3,
      completion_prompt_ratio: 1.5,
      safety_buffer_pct: 20,
      version: 1,
      is_active: true,
      change_reason: "initial seed",
      updated_by: "system",
      created_at: now,
      updated_at: now,
    },
    {
      id: 2,
      provider: "ali",
      model: "qwen-plus",
      operation: "sop_step",
      char_to_token_ratio: 3,
      completion_prompt_ratio: 1.2,
      safety_buffer_pct: 15,
      version: 1,
      is_active: true,
      change_reason: "initial seed",
      updated_by: "system",
      created_at: now,
      updated_at: now,
    },
    {
      id: 3,
      provider: "ali",
      model: "qwen-turbo",
      operation: "salesrag_chat",
      char_to_token_ratio: 3,
      completion_prompt_ratio: 1.0,
      safety_buffer_pct: 15,
      version: 1,
      is_active: true,
      change_reason: "initial seed",
      updated_by: "system",
      created_at: now,
      updated_at: now,
    },
  ];
}

const state: MockState = {
  coefficients: seedCoefficients(),
  nextCoefId: 4,
};

// ---- Handler implementations ----

type Handler = (
  config: InternalAxiosRequestConfig,
  match: RegExpMatchArray,
) => unknown;

function ok<T>(data: T, config: InternalAxiosRequestConfig): AxiosResponse {
  return {
    data: { code: 0, message: "ok", data },
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  };
}

function parseBody<T>(config: InternalAxiosRequestConfig): T {
  const raw = config.data;
  if (!raw) return {} as T;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return {} as T;
    }
  }
  return raw as T;
}

function listCoefficientsHandler(config: InternalAxiosRequestConfig) {
  const params = (config.params ?? {}) as {
    provider?: string;
    model?: string;
    operation?: string;
    is_active?: "1" | "all";
    page?: number;
    page_size?: number;
  };
  let rows = [...state.coefficients];
  if (params.provider) {
    rows = rows.filter((r) => r.provider.includes(params.provider!));
  }
  if (params.model) {
    rows = rows.filter((r) => r.model.includes(params.model!));
  }
  if (params.operation) {
    rows = rows.filter((r) => r.operation.includes(params.operation!));
  }
  if (!params.is_active || params.is_active === "1") {
    rows = rows.filter((r) => r.is_active);
  }
  const resp: ListCoefficientsResp = { list: rows, total: rows.length };
  return ok(resp, config);
}

function historyCoefficientsHandler(config: InternalAxiosRequestConfig) {
  const params = (config.params ?? {}) as {
    provider: string;
    model: string;
    operation: string;
  };
  // For mock: return the single latest + a synthetic v0
  const latest = state.coefficients.find(
    (c) =>
      c.provider === params.provider &&
      c.model === params.model &&
      c.operation === params.operation,
  );
  const list: EstimationCoefficient[] = latest
    ? [
        latest,
        {
          ...latest,
          id: latest.id * 1000,
          version: Math.max(1, latest.version - 1),
          is_active: false,
          change_reason: "previous version (mock)",
          updated_by: "system",
        },
      ]
    : [];
  return ok({ list }, config);
}

function createCoefficientHandler(config: InternalAxiosRequestConfig) {
  const body = parseBody<UpdateCoefficientReq>(config);
  const now = new Date().toISOString();
  const item: EstimationCoefficient = {
    id: state.nextCoefId++,
    provider: body.provider,
    model: body.model,
    operation: body.operation,
    char_to_token_ratio: body.char_to_token_ratio,
    completion_prompt_ratio: body.completion_prompt_ratio,
    safety_buffer_pct: body.safety_buffer_pct,
    version: 1,
    is_active: true,
    change_reason: body.change_reason,
    updated_by: "mock-admin",
    created_at: now,
    updated_at: now,
  };
  state.coefficients.push(item);
  return ok(item, config);
}

function updateCoefficientHandler(
  config: InternalAxiosRequestConfig,
  match: RegExpMatchArray,
) {
  const id = Number(match[1]);
  const idx = state.coefficients.findIndex((c) => c.id === id);
  if (idx === -1) {
    return {
      data: { code: "NotFound", message: "coefficient not found" },
      status: 404,
      statusText: "Not Found",
      headers: {},
      config,
    } satisfies AxiosResponse;
  }
  const body = parseBody<UpdateCoefficientReq>(config);
  const prev = state.coefficients[idx];
  const now = new Date().toISOString();
  const next: EstimationCoefficient = {
    ...prev,
    char_to_token_ratio: body.char_to_token_ratio,
    completion_prompt_ratio: body.completion_prompt_ratio,
    safety_buffer_pct: body.safety_buffer_pct,
    version: prev.version + 1,
    change_reason: body.change_reason,
    updated_by: "mock-admin",
    updated_at: now,
  };
  state.coefficients[idx] = next;
  return ok(next, config);
}

function deleteCoefficientHandler(
  config: InternalAxiosRequestConfig,
  match: RegExpMatchArray,
) {
  const id = Number(match[1]);
  const idx = state.coefficients.findIndex((c) => c.id === id);
  if (idx === -1) {
    return {
      data: { code: "NotFound", message: "coefficient not found" },
      status: 404,
      statusText: "Not Found",
      headers: {},
      config,
    } satisfies AxiosResponse;
  }
  state.coefficients[idx] = { ...state.coefficients[idx], is_active: false };
  return ok(null, config);
}

// ---- Router ----

interface Route {
  method: string;
  pattern: RegExp;
  handler: Handler;
}

const routes: Route[] = [
  {
    method: "GET",
    pattern: /^\/v1\/admin\/estimation-coefficients\/history(?:\?|$)/,
    handler: historyCoefficientsHandler,
  },
  {
    method: "GET",
    pattern: /^\/v1\/admin\/estimation-coefficients(?:\?|$)/,
    handler: listCoefficientsHandler,
  },
  {
    method: "POST",
    pattern: /^\/v1\/admin\/estimation-coefficients(?:\?|$)/,
    handler: createCoefficientHandler,
  },
  {
    method: "PUT",
    pattern: /^\/v1\/admin\/estimation-coefficients\/(\d+)(?:\?|$)/,
    handler: updateCoefficientHandler,
  },
  {
    method: "DELETE",
    pattern: /^\/v1\/admin\/estimation-coefficients\/(\d+)(?:\?|$)/,
    handler: deleteCoefficientHandler,
  },
];

/**
 * Try to handle a request with one of the mock routes.
 * Returns an AxiosResponse-compatible object when matched, otherwise null
 * (in which case the caller should fall back to real network).
 */
export function tryHandleAdminMock(
  config: InternalAxiosRequestConfig,
): AxiosResponse | null {
  const method = (config.method ?? "get").toUpperCase();
  const url = config.url ?? "";
  for (const route of routes) {
    if (route.method !== method) continue;
    const match = url.match(route.pattern);
    if (!match) continue;
    return route.handler(config, match) as AxiosResponse;
  }
  return null;
}

/**
 * Install the mock adapter on an axios instance. Call once at bootstrap when
 * `VITE_USE_ADMIN_MOCKS=1` to redirect the target endpoints to in-memory mocks.
 *
 * Example usage (e.g. src/main.ts):
 *   import request from '@/api/request'
 *   import { installAdminMocks } from '@/mocks/admin-handlers'
 *   if (import.meta.env.VITE_USE_ADMIN_MOCKS === '1') {
 *     installAdminMocks(request)
 *   }
 */
export function installAdminMocks(axiosInstance: {
  defaults: { adapter?: unknown };
}) {
  const prev = axiosInstance.defaults.adapter;
  const mockAdapter = async (
    config: InternalAxiosRequestConfig,
  ): Promise<AxiosResponse> => {
    const handled = tryHandleAdminMock(config);
    if (handled) return handled;
    // Not one of ours — delegate to previous adapter (real xhr/fetch).
    if (typeof prev === "function") {
      return (
        prev as unknown as (c: AxiosRequestConfig) => Promise<AxiosResponse>
      )(config);
    }
    // No prior adapter registered — return a network error stub.
    throw new Error(
      `No prior axios adapter registered; cannot forward ${config.method} ${config.url}`,
    );
  };
  axiosInstance.defaults.adapter = mockAdapter;
}

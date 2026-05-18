/**
 * Unit tests for the admin-mocks router (Track F.4).
 *
 * Ensures each mocked endpoint returns the expected shape.
 */
import { describe, it, expect } from "vitest";
import type { InternalAxiosRequestConfig, AxiosHeaders } from "axios";
import { tryHandleAdminMock } from "@/mocks/admin-handlers";

function req(
  method: string,
  url: string,
  opts: Partial<InternalAxiosRequestConfig> = {},
): InternalAxiosRequestConfig {
  return {
    method,
    url,
    headers: {} as AxiosHeaders,
    ...opts,
  } as InternalAxiosRequestConfig;
}

describe("admin-handlers — estimation coefficients", () => {
  it("GET /v1/admin/estimation-coefficients returns list envelope", () => {
    const resp = tryHandleAdminMock(
      req("GET", "/v1/admin/estimation-coefficients"),
    );
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(200);
    const body = resp!.data as {
      code: number;
      data: { list: unknown[]; total: number };
    };
    expect(body.code).toBe(0);
    expect(Array.isArray(body.data.list)).toBe(true);
    expect(body.data.total).toBeGreaterThanOrEqual(1);
  });

  it("GET .../history returns versioned list", () => {
    const resp = tryHandleAdminMock(
      req("GET", "/v1/admin/estimation-coefficients/history", {
        params: {
          provider: "volc",
          model: "glm-4-7-251222",
          operation: "sop_step",
        },
      }),
    );
    expect(resp).not.toBeNull();
    const body = resp!.data as {
      code: number;
      data: { list: Array<{ version: number }> };
    };
    expect(body.code).toBe(0);
    expect(body.data.list.length).toBeGreaterThanOrEqual(1);
  });

  it("POST creates a coefficient", () => {
    const resp = tryHandleAdminMock(
      req("POST", "/v1/admin/estimation-coefficients", {
        data: JSON.stringify({
          provider: "baidu",
          model: "ernie-foo",
          operation: "sop_step",
          char_to_token_ratio: 2.5,
          completion_prompt_ratio: 1.1,
          safety_buffer_pct: 20,
          change_reason: "adding baidu",
        }),
      }),
    );
    expect(resp).not.toBeNull();
    const body = resp!.data as {
      code: number;
      data: { id: number; provider: string };
    };
    expect(body.data.provider).toBe("baidu");
  });
});

describe("admin-handlers — no-match", () => {
  it("returns null for unknown endpoints", () => {
    const resp = tryHandleAdminMock(req("GET", "/v1/admin/unknown"));
    expect(resp).toBeNull();
  });
});

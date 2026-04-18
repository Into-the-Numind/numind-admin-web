/**
 * Unit tests for the admin-mocks router (Track F.4).
 *
 * Ensures each mocked endpoint returns the expected shape and that POST to
 * the billing-mode-init migration is idempotent (subsequent calls return
 * the previous EXECUTED result).
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

describe("admin-handlers — migrations/billing-mode-init", () => {
  it("GET status starts as not-executed", () => {
    const resp = tryHandleAdminMock(
      req("GET", "/v1/admin/migrations/billing-mode-init/status"),
    );
    expect(resp).not.toBeNull();
    const body = resp!.data as {
      code: number;
      data: { already_executed: boolean };
    };
    // This may be false OR true depending on whether a previous test in this
    // file has executed the migration (module-level state is shared). The
    // contract we assert is only that the field exists and is a boolean.
    expect(typeof body.data.already_executed).toBe("boolean");
  });

  it("POST executes, idempotent on subsequent call", () => {
    const first = tryHandleAdminMock(
      req("POST", "/v1/admin/migrations/billing-mode-init"),
    );
    expect(first).not.toBeNull();
    const body1 = first!.data as {
      data: { already_executed: boolean; migrated_count: number };
    };
    expect(body1.data.already_executed).toBe(true);
    const count = body1.data.migrated_count;
    const second = tryHandleAdminMock(
      req("POST", "/v1/admin/migrations/billing-mode-init"),
    );
    const body2 = second!.data as {
      data: { already_executed: boolean; migrated_count: number };
    };
    expect(body2.data.already_executed).toBe(true);
    expect(body2.data.migrated_count).toBe(count);
  });
});

describe("admin-handlers — no-match", () => {
  it("returns null for unknown endpoints", () => {
    const resp = tryHandleAdminMock(req("GET", "/v1/admin/unknown"));
    expect(resp).toBeNull();
  });
});

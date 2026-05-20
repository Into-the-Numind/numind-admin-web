import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted to share spies between vi.mock factory and tests
const spies = vi.hoisted(() => ({
  patch: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("axios", () => {
  const mockInstance = {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: spies.get,
    post: spies.post,
    put: spies.put,
    delete: spies.delete,
    patch: spies.patch,
  };
  return {
    default: {
      create: vi.fn(() => mockInstance),
    },
  };
});

// Avoid pulling Pinia / router into this isolated unit test
vi.mock("@/stores/auth", () => ({ useAuthStore: () => ({ token: "" }) }));
vi.mock("@/router", () => ({ default: { push: vi.fn() } }));

// Import AFTER mocks are set up
import { patch, get, post, put, del } from "../request";

describe("request.ts PATCH helper (M2)", () => {
  beforeEach(() => {
    spies.patch.mockReset();
    spies.get.mockReset();
    spies.post.mockReset();
    spies.put.mockReset();
    spies.delete.mockReset();
  });

  it("patch() delegates to axios.patch with url + data + config", async () => {
    spies.patch.mockResolvedValue({ ok: true });
    const data = { foo: 1 };
    const config = { params: { x: 2 } };
    await patch("/v1/foo", data, config);
    expect(spies.patch).toHaveBeenCalledWith("/v1/foo", data, config);
  });

  it("patch() returns the axios resolved value verbatim", async () => {
    spies.patch.mockResolvedValue({ ok: true });
    const res = await patch<{ ok: boolean }>("/v1/foo");
    expect(res).toEqual({ ok: true });
  });

  it("get/post/put/del/patch helpers all exist as functions", () => {
    expect(typeof get).toBe("function");
    expect(typeof post).toBe("function");
    expect(typeof put).toBe("function");
    expect(typeof del).toBe("function");
    expect(typeof patch).toBe("function");
  });
});

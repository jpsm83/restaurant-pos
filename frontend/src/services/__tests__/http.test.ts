import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreate, mockGetAccessToken } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockGetAccessToken: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    create: (...args: unknown[]) => mockCreate(...args),
  },
}));

vi.mock("@/auth/api", () => ({
  getAccessToken: () => mockGetAccessToken(),
}));

describe("http service", () => {
  beforeEach(() => {
    vi.resetModules();
    mockCreate.mockReset();
    mockGetAccessToken.mockReset();
  });

  it("creates axios instance with credentials and JSON defaults", async () => {
    const requestUse = vi.fn();
    mockCreate.mockReturnValue({
      interceptors: { request: { use: requestUse } },
    });
    await import("../http");

    expect(mockCreate).toHaveBeenCalledWith({
      baseURL: "",
      withCredentials: true,
      headers: { "Content-Type": "application/json" },
    });
    expect(requestUse).toHaveBeenCalledTimes(1);
  });

  it("attaches bearer token when access token exists", async () => {
    let interceptor: ((config: Record<string, any>) => Record<string, any>) | undefined;
    mockCreate.mockReturnValue({
      interceptors: {
        request: {
          use: (fn: typeof interceptor) => {
            interceptor = fn;
          },
        },
      },
    });
    mockGetAccessToken.mockReturnValue("jwt-token");
    await import("../http");

    const config = { headers: {} as Record<string, string> };
    const result = interceptor?.(config);
    expect(result?.headers.Authorization).toBe("Bearer jwt-token");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockHttpGet,
  mockHttpPost,
  mockToServiceRequestError,
  mockUseQuery,
  mockUseMutation,
  mockInvalidateQueries,
} = vi.hoisted(() => ({
  mockHttpGet: vi.fn(),
  mockHttpPost: vi.fn(),
  mockToServiceRequestError: vi.fn(),
  mockUseQuery: vi.fn(),
  mockUseMutation: vi.fn(),
  mockInvalidateQueries: vi.fn(),
}));

vi.mock("../http", () => ({
  http: {
    get: (...args: unknown[]) => mockHttpGet(...args),
    post: (...args: unknown[]) => mockHttpPost(...args),
  },
}));

vi.mock("../serviceErrors", () => ({
  toServiceRequestError: (...args: unknown[]) => mockToServiceRequestError(...args),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => ({
    invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
  }),
}));

import {
  EMPLOYEE_MODE_NOT_ALLOWED_MESSAGE,
  getAuthMode,
  setAuthMode,
  useAuthModeQuery,
  useSetAuthModeMutation,
} from "../authMode";

describe("authMode service", () => {
  beforeEach(() => {
    mockHttpGet.mockReset();
    mockHttpPost.mockReset();
    mockToServiceRequestError.mockReset();
    mockUseQuery.mockReset();
    mockUseMutation.mockReset();
    mockInvalidateQueries.mockReset();
  });

  it("fetches mode and normalizes unknown mode to customer", async () => {
    mockHttpGet.mockResolvedValueOnce({ data: { mode: "employee" } });
    await expect(getAuthMode()).resolves.toBe("employee");

    mockHttpGet.mockResolvedValueOnce({ data: { mode: "unexpected" } });
    await expect(getAuthMode()).resolves.toBe("customer");
  });

  it("maps get errors through service error helper", async () => {
    const original = new Error("boom");
    const mapped = new Error("mapped");
    mockHttpGet.mockRejectedValueOnce(original);
    mockToServiceRequestError.mockReturnValueOnce(mapped);

    await expect(getAuthMode()).rejects.toBe(mapped);
  });

  it("posts mode and maps error message for set", async () => {
    await setAuthMode("customer");
    expect(mockHttpPost).toHaveBeenCalledWith("/api/v1/auth/set-mode", {
      mode: "customer",
    });

    mockHttpPost.mockRejectedValueOnce(new Error("403"));
    mockToServiceRequestError.mockReturnValueOnce({
      message: EMPLOYEE_MODE_NOT_ALLOWED_MESSAGE,
    });
    await expect(setAuthMode("employee")).rejects.toThrow(
      EMPLOYEE_MODE_NOT_ALLOWED_MESSAGE,
    );
  });

  it("wires query and mutation hooks to query keys/invalidation", () => {
    useAuthModeQuery({ enabled: false });
    const queryConfig = mockUseQuery.mock.calls[0][0] as {
      enabled: boolean;
      queryKey: readonly string[];
    };
    expect(queryConfig.queryKey).toEqual(["auth", "mode"]);
    expect(queryConfig.enabled).toBe(false);

    useSetAuthModeMutation();
    const mutationConfig = mockUseMutation.mock.calls[0][0] as {
      onSuccess: () => void;
    };
    mutationConfig.onSuccess();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["auth", "mode"],
    });
  });
});

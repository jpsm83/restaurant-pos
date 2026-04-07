import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockHttpGet,
  mockHttpPost,
  mockHttpPatch,
  mockUseMutation,
  mockUseQuery,
  mockSetAccessToken,
  mockToServiceRequestError,
} = vi.hoisted(() => ({
  mockHttpGet: vi.fn(),
  mockHttpPost: vi.fn(),
  mockHttpPatch: vi.fn(),
  mockUseMutation: vi.fn(),
  mockUseQuery: vi.fn(),
  mockSetAccessToken: vi.fn(),
  mockToServiceRequestError: vi.fn(),
}));

vi.mock("../../http", () => ({
  http: {
    get: (...args: unknown[]) => mockHttpGet(...args),
    post: (...args: unknown[]) => mockHttpPost(...args),
    patch: (...args: unknown[]) => mockHttpPatch(...args),
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("@/auth/api", () => ({
  setAccessToken: (token: string | null) => mockSetAccessToken(token),
  getAccessToken: () => null,
}));

vi.mock("../../serviceErrors", async () => {
  const actual = await vi.importActual("../../serviceErrors");
  return {
    ...(actual as object),
    toServiceRequestError: (...args: unknown[]) => mockToServiceRequestError(...args),
  };
});

import {
  createBusiness,
  fetchManagementContactOptions,
  getBusinessById,
  useBusinessProfileQuery,
  useCreateBusinessMutation,
  useUpdateBusinessProfileMutation,
} from "../businessProfileApi";

describe("businessProfileApi", () => {
  beforeEach(() => {
    mockHttpGet.mockReset();
    mockHttpPost.mockReset();
    mockHttpPatch.mockReset();
    mockUseMutation.mockReset();
    mockUseQuery.mockReset();
    mockSetAccessToken.mockReset();
    mockToServiceRequestError.mockReset();
  });

  it("returns [] when management contacts response is not an array", async () => {
    mockHttpGet.mockResolvedValueOnce({ data: null });
    await expect(fetchManagementContactOptions("b-1")).resolves.toEqual([]);
  });

  it("returns business profile payload from getBusinessById", async () => {
    mockHttpGet.mockResolvedValueOnce({ data: { _id: "b-1", tradeName: "Demo" } });
    await expect(getBusinessById("b-1")).resolves.toMatchObject({
      _id: "b-1",
      tradeName: "Demo",
    });
  });

  it("maps createBusiness error into BusinessServiceError", async () => {
    const mapped = { message: "mapped", status: 409 };
    mockHttpPost.mockRejectedValueOnce(new Error("request failed"));
    mockToServiceRequestError.mockReturnValueOnce(mapped);
    await expect(createBusiness(new FormData())).rejects.toMatchObject({
      name: "BusinessServiceError",
      message: "mapped",
      status: 409,
    });
  });

  it("wires query/mutation hooks", () => {
    useCreateBusinessMutation();
    const createConfig = mockUseMutation.mock.calls[0][0] as {
      mutationFn: unknown;
    };
    expect(typeof createConfig.mutationFn).toBe("function");

    useUpdateBusinessProfileMutation();
    const updateConfig = mockUseMutation.mock.calls[1][0] as {
      mutationFn: unknown;
    };
    expect(typeof updateConfig.mutationFn).toBe("function");

    useBusinessProfileQuery(undefined);
    const queryConfig = mockUseQuery.mock.calls[0][0] as {
      queryKey: readonly string[];
      enabled: boolean;
    };
    expect(queryConfig.queryKey).toEqual(["business", "detail", "pending"]);
    expect(queryConfig.enabled).toBe(false);
  });
});

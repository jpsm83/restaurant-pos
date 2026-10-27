import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockHttpGet,
  mockHttpPost,
  mockHttpPatch,
  mockUseMutation,
  mockUseQuery,
  mockSetAccessToken,
} = vi.hoisted(() => ({
  mockHttpGet: vi.fn(),
  mockHttpPost: vi.fn(),
  mockHttpPatch: vi.fn(),
  mockUseMutation: vi.fn(),
  mockUseQuery: vi.fn(),
  mockSetAccessToken: vi.fn(),
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

import {
  createBusiness,
  fetchManagementContactOptions,
  getBusinessById,
  updateBusinessProfile,
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

  it("maps createBusiness problem details into BusinessServiceError", async () => {
    mockHttpPost.mockRejectedValueOnce({
      isAxiosError: true,
      message: "Request failed with status code 409",
      response: {
        status: 409,
        data: {
          type: "https://restaurant-pos.app/errors/conflict",
          title: "Conflict",
          status: 409,
          detail: "A business with the same tax number already exists",
          instance: "/api/v1/business",
        },
      },
    });

    await expect(createBusiness(new FormData())).rejects.toMatchObject({
      name: "BusinessServiceError",
      code: "businessCreate.conflict",
      serverMessage: "A business with the same tax number already exists",
      status: 409,
    });
  });

  it("maps getBusinessById status to a machine failure code", async () => {
    mockHttpGet.mockRejectedValueOnce({
      isAxiosError: true,
      message: "Request failed with status code 404",
      response: { status: 404, data: { status: 404, title: "Not Found" } },
    });

    await expect(getBusinessById("b-1")).rejects.toMatchObject({
      name: "BusinessServiceError",
      code: "businessFetch.notFound",
      status: 404,
    });
  });

  it("maps updateBusinessProfile problem details", async () => {
    mockHttpPatch.mockRejectedValueOnce({
      isAxiosError: true,
      message: "Request failed with status code 403",
      response: {
        status: 403,
        data: { status: 403, detail: "You cannot edit this business" },
      },
    });

    await expect(
      updateBusinessProfile("b-1", new FormData()),
    ).rejects.toMatchObject({
      name: "BusinessServiceError",
      code: "businessUpdate.forbidden",
      serverMessage: "You cannot edit this business",
      status: 403,
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

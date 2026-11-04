import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockHttpGet,
  mockHttpPatch,
  mockHttpPost,
  mockUseMutation,
  mockUseQuery,
} = vi.hoisted(() => ({
  mockHttpGet: vi.fn(),
  mockHttpPatch: vi.fn(),
  mockHttpPost: vi.fn(),
  mockUseMutation: vi.fn(),
  mockUseQuery: vi.fn(),
}));

vi.mock("../../http", () => ({
  http: {
    get: (...args: unknown[]) => mockHttpGet(...args),
    patch: (...args: unknown[]) => mockHttpPatch(...args),
    post: (...args: unknown[]) => mockHttpPost(...args),
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

import {
  fetchManagementContactOptions,
  getBusinessById,
  requestBusinessContactVerification,
  updateBusinessProfile,
  useBusinessProfileQuery,
  useUpdateBusinessProfileMutation,
} from "../businessProfileApi";

describe("businessProfileApi", () => {
  beforeEach(() => {
    mockHttpGet.mockReset();
    mockHttpPatch.mockReset();
    mockHttpPost.mockReset();
    mockUseMutation.mockReset();
    mockUseQuery.mockReset();
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

  it("requests contact verification for the addressed venue and returns its outcome", async () => {
    mockHttpPost.mockResolvedValueOnce({
      data: { outcome: "cooldown", message: "Server copy" },
    });

    await expect(
      requestBusinessContactVerification("b-1"),
    ).resolves.toEqual({ outcome: "cooldown" });
    expect(mockHttpPost).toHaveBeenCalledWith(
      "/api/v1/business/b-1/request-email-verification",
      {},
    );
  });

  it("rejects an unexpected success body instead of claiming an email was sent", async () => {
    mockHttpPost.mockResolvedValueOnce({ data: { message: "Server copy" } });

    await expect(
      requestBusinessContactVerification("b-1"),
    ).rejects.toMatchObject({
      code: "businessContactVerification.internal",
    });
  });

  it("maps contact-verification problem details", async () => {
    mockHttpPost.mockRejectedValueOnce({
      isAxiosError: true,
      message: "Request failed with status code 400",
      response: {
        status: 400,
        data: { status: 400, detail: "Add a contact email first" },
      },
    });

    await expect(
      requestBusinessContactVerification("b-1"),
    ).rejects.toMatchObject({
      name: "BusinessServiceError",
      code: "businessContactVerification.badRequest",
      status: 400,
    });
  });

  it("wires query/mutation hooks", () => {
    useUpdateBusinessProfileMutation();
    const updateConfig = mockUseMutation.mock.calls[0][0] as {
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

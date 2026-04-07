/**
 * Unit tests for `businessService.ts` — mocks `./http` and `@/auth/api.setAccessToken`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBusiness, updateBusinessProfile } from "../businessService";

const { mockPost, mockPatch, mockSetAccessToken } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockPatch: vi.fn(),
  mockSetAccessToken: vi.fn(),
}));

vi.mock("@/auth/api", () => ({
  setAccessToken: (token: string | null) => mockSetAccessToken(token),
  getAccessToken: () => null,
}));

vi.mock("../../http", () => ({
  http: {
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
  },
}));

function minimalFormData() {
  const fd = new FormData();
  fd.append("tradeName", "Café Demo");
  fd.append("legalName", "Café Demo LLC");
  fd.append("email", "owner@demo.test");
  fd.append("password", "Secret1!a");
  fd.append("phoneNumber", "+1000000000");
  fd.append("taxNumber", "TAX-UNIQUE-001");
  fd.append("subscription", "Free");
  fd.append("currencyTrade", "USD");
  fd.append(
    "address",
    JSON.stringify({
      country: "CH",
      state: "VD",
      city: "Lausanne",
      street: "Rue Test",
      buildingNumber: "1",
      postCode: "1000",
    }),
  );
  return fd;
}

describe("createBusiness (Phase 4.3.1)", () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockPatch.mockReset();
    mockSetAccessToken.mockReset();
  });

  it("POSTs multipart FormData to /api/v1/business with transformRequest for FormData", async () => {
    mockPost.mockResolvedValue({
      data: {
        message: "Business created",
        accessToken: "access-jwt",
        user: { id: "507f1f77bcf86cd799439011", email: "owner@demo.test", type: "business" },
      },
    });

    const fd = minimalFormData();
    const result = await createBusiness(fd);

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, body, config] = mockPost.mock.calls[0] as [
      string,
      FormData,
      { transformRequest?: unknown[] },
    ];
    expect(url).toBe("/api/v1/business");
    expect(body).toBe(fd);
    expect(Array.isArray(config?.transformRequest)).toBe(true);

    const sent = mockPost.mock.calls[0][1] as FormData;
    expect(sent.get("tradeName")).toBe("Café Demo");
    expect(sent.get("subscription")).toBe("Free");
    expect(sent.get("currencyTrade")).toBe("USD");
    const addr = JSON.parse(sent.get("address") as string) as Record<string, string>;
    expect(addr.country).toBe("CH");
    expect(addr.postCode).toBe("1000");

    expect(mockSetAccessToken).toHaveBeenCalledWith("access-jwt");
    expect(result.user.type).toBe("business");
    expect(result.user.email).toBe("owner@demo.test");
  });

  it("PATCHes profile with idempotency/correlation headers and syncs token", async () => {
    mockPatch.mockResolvedValue({
      data: {
        message: "Business updated",
        accessToken: "refreshed-token",
        user: {
          id: "507f1f77bcf86cd799439011",
          email: "owner@demo.test",
          type: "business",
        },
      },
    });

    const fd = minimalFormData();
    const result = await updateBusinessProfile(
      "507f1f77bcf86cd799439011",
      fd,
      { operationId: "op-123" },
    );

    expect(mockPatch).toHaveBeenCalledTimes(1);
    const [url, body, config] = mockPatch.mock.calls[0] as [
      string,
      FormData,
      { headers?: Record<string, string> },
    ];
    expect(url).toBe("/api/v1/business/507f1f77bcf86cd799439011");
    expect(body).toBe(fd);
    expect(config.headers?.["X-Idempotency-Key"]).toBe("op-123");
    expect(config.headers?.["X-Correlation-Id"]).toBe("op-123");

    expect(mockSetAccessToken).toHaveBeenCalledWith("refreshed-token");
    expect(result.user?.type).toBe("business");
  });

  it("coalesces concurrent profile updates for the same business", async () => {
    type MockAxiosPatchResult = {
      data: {
        message: string;
        user: { id: string; email: string; type: "business" };
      };
    };
    const deferred: {
      resolve?: (value: MockAxiosPatchResult) => void;
    } = {};
    const pending = new Promise<MockAxiosPatchResult>((resolve) => {
      deferred.resolve = resolve;
    });
    mockPatch.mockReturnValue(pending);

    const fd1 = minimalFormData();
    const fd2 = minimalFormData();
    const p1 = updateBusinessProfile("507f1f77bcf86cd799439011", fd1);
    const p2 = updateBusinessProfile("507f1f77bcf86cd799439011", fd2);

    expect(p1).toBe(p2);
    expect(mockPatch).toHaveBeenCalledTimes(1);

    deferred.resolve?.({
      data: {
        message: "Business updated",
        user: {
          id: "507f1f77bcf86cd799439011",
          email: "owner@demo.test",
          type: "business",
        },
      },
    });

    await expect(p1).resolves.toMatchObject({ message: "Business updated" });
  });
});

/**
 * Unit tests for `businessService.ts` — mocks `./http` and `@/auth/api.setAccessToken`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBusiness } from "./businessService";

const { mockPost, mockSetAccessToken } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockSetAccessToken: vi.fn(),
}));

vi.mock("@/auth/api", () => ({
  setAccessToken: (token: string | null) => mockSetAccessToken(token),
}));

vi.mock("./http", () => ({
  http: {
    post: (...args: unknown[]) => mockPost(...args),
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
});

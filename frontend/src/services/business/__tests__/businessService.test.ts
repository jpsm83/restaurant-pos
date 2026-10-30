/**
 * Unit tests for `businessService.ts` — venue profile updates over the shared `http`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateBusinessProfile } from "../businessService";

const { mockPatch } = vi.hoisted(() => ({
  mockPatch: vi.fn(),
}));

vi.mock("../../http", () => ({
  http: {
    patch: (...args: unknown[]) => mockPatch(...args),
  },
}));

function minimalFormData() {
  const fd = new FormData();
  fd.append("tradeName", "Café Demo");
  fd.append("email", "owner@demo.test");
  fd.append("phoneNumber", "+1000000000");
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

describe("updateBusinessProfile", () => {
  beforeEach(() => {
    mockPatch.mockReset();
  });

  it("PATCHes profile with idempotency/correlation headers", async () => {
    mockPatch.mockResolvedValue({
      data: { message: "Business updated" },
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

    expect(result).toEqual({ message: "Business updated" });
  });

  it("coalesces concurrent profile updates for the same business", async () => {
    type MockAxiosPatchResult = {
      data: {
        message: string;
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
      },
    });

    await expect(p1).resolves.toMatchObject({ message: "Business updated" });
  });
});

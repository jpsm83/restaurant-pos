import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockHttpGet, mockToServiceRequestError, mockUseQuery } = vi.hoisted(
  () => ({
    mockHttpGet: vi.fn(),
    mockToServiceRequestError: vi.fn(),
    mockUseQuery: vi.fn(),
  }),
);

vi.mock("../http", () => ({
  http: {
    get: (...args: unknown[]) => mockHttpGet(...args),
  },
}));

vi.mock("../serviceErrors", () => ({
  toServiceRequestError: (...args: unknown[]) => mockToServiceRequestError(...args),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

import {
  fetchDailyEmployeeSchedule,
  useNextShiftForEmployee,
} from "../schedulesService";

describe("schedulesService", () => {
  beforeEach(() => {
    mockHttpGet.mockReset();
    mockToServiceRequestError.mockReset();
    mockUseQuery.mockReset();
  });

  it("fetches daily schedule with business/day query params", async () => {
    const payload = { rows: [] };
    mockHttpGet.mockResolvedValueOnce({ data: payload });

    await expect(fetchDailyEmployeeSchedule("b-1", "2026-04-07")).resolves.toEqual(
      payload,
    );

    expect(mockHttpGet).toHaveBeenCalledWith(
      "/api/v1/schedules/business/b-1/daily",
      { params: { dayKey: "2026-04-07" }, signal: undefined },
    );
  });

  it("maps fetch errors through service error helper", async () => {
    const original = new Error("boom");
    const mapped = new Error("mapped");
    mockHttpGet.mockRejectedValueOnce(original);
    mockToServiceRequestError.mockReturnValueOnce(mapped);

    await expect(fetchDailyEmployeeSchedule("b-1", "2026-04-07")).rejects.toBe(
      mapped,
    );
  });

  it("uses pending key when required identifiers are missing", () => {
    useNextShiftForEmployee({
      businessId: undefined,
      employeeId: "e-1",
      dayKey: "2026-04-07",
      enabled: true,
    });

    const config = mockUseQuery.mock.calls[0][0] as {
      queryKey: readonly string[];
      enabled: boolean;
    };
    expect(config.queryKey).toEqual(["schedules", "employeeDay", "pending"]);
    expect(config.enabled).toBe(false);
  });

  it("uses employee day key and runs when identifiers exist", () => {
    useNextShiftForEmployee({
      businessId: "b-1",
      employeeId: "e-1",
      dayKey: "2026-04-07",
      enabled: true,
    });

    const config = mockUseQuery.mock.calls[0][0] as {
      queryKey: readonly string[];
      enabled: boolean;
    };
    expect(config.queryKey).toEqual([
      "schedules",
      "employeeDay",
      "b-1",
      "e-1",
      "2026-04-07",
    ]);
    expect(config.enabled).toBe(true);
  });
});

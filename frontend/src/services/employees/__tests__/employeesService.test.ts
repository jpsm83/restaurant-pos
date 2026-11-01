/**
 * Employees service tests — access snapshot, membership reads, and hire
 * request shape at the shared `http` boundary.
 */
import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchBusinessAccessSnapshot,
  fetchEmployeeMembership,
  fetchVenueMemberships,
  hireEmployee,
  hireFailureReason,
} from "../employeesService";

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock("../../http", () => ({
  http: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

const accessSnapshot = {
  businessId: "64b000000000000000000001",
  effectiveLayer: "manager",
  source: "membership",
  jobRoles: ["Manager"],
  capabilities: ["viewInventory"],
  canEnterBusiness: true,
};

describe("employeesService", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it("reads the caller's access snapshot for a venue", async () => {
    mockGet.mockResolvedValue({ data: accessSnapshot });
    const controller = new AbortController();

    await expect(
      fetchBusinessAccessSnapshot(
        "64b000000000000000000001",
        controller.signal,
      ),
    ).resolves.toEqual(accessSnapshot);

    expect(mockGet).toHaveBeenCalledWith(
      "/api/v1/business/64b000000000000000000001/access",
      { signal: controller.signal },
    );
  });

  it("reads the venue membership list", async () => {
    const rows = [
      {
        _id: "e1",
        businessId: "b1",
        userId: "u1",
        allEmployeeRoles: ["Waiter"],
        employmentStatus: "Active",
        joinDate: "2026-04-07T00:00:00.000Z",
        displayName: "Ada Lovelace",
        email: "ada@example.com",
      },
    ];
    mockGet.mockResolvedValue({ data: rows });
    const controller = new AbortController();

    await expect(
      fetchVenueMemberships("b1", controller.signal),
    ).resolves.toEqual(rows);

    expect(mockGet).toHaveBeenCalledWith(
      "/api/v1/employees/business/b1",
      { signal: controller.signal },
    );
  });

  it("reads one membership for the self/manager view", async () => {
    const row = {
      _id: "e1",
      businessId: "b1",
      userId: "u1",
      allEmployeeRoles: ["Waiter"],
      joinDate: "2026-04-07T00:00:00.000Z",
    };
    mockGet.mockResolvedValue({ data: row });
    const controller = new AbortController();

    await expect(
      fetchEmployeeMembership("e1", controller.signal),
    ).resolves.toEqual(row);

    expect(mockGet).toHaveBeenCalledWith("/api/v1/employees/e1", {
      signal: controller.signal,
    });
  });

  it("posts the minimal hire as multipart form data", async () => {
    mockPost.mockResolvedValue({
      data: { message: "New employee created successfully!" },
    });

    await hireEmployee({
      businessId: "b1",
      userEmail: "new@example.com",
      allEmployeeRoles: ["Waiter", "Host"],
      employmentStatus: "Seasonal",
      joinDate: "2026-04-07",
    });

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, body, config] = mockPost.mock.calls[0] as [
      string,
      FormData,
      { transformRequest?: unknown },
    ];

    expect(url).toBe("/api/v1/employees");
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("businessId")).toBe("b1");
    expect(body.get("userEmail")).toBe("new@example.com");
    expect(JSON.parse(String(body.get("allEmployeeRoles")))).toEqual([
      "Waiter",
      "Host",
    ]);
    expect(body.get("employmentStatus")).toBe("Seasonal");
    expect(body.get("joinDate")).toBe("2026-04-07");
    expect(config.transformRequest).toEqual(expect.any(Array));
  });

  it("maps transport failures to employee operation codes", async () => {
    const response = {
      status: 403,
      data: { type: "https://restaurant-pos.app/errors/forbidden" },
    } as AxiosResponse;
    mockGet.mockRejectedValue(
      new AxiosError(
        "forbidden",
        "ERR_BAD_REQUEST",
        undefined,
        undefined,
        response,
      ),
    );

    await expect(fetchVenueMemberships("b1")).rejects.toMatchObject({
      code: "employeesFetch.forbidden",
      status: 403,
    });
  });

  it("classifies known hire outcomes by machine code", () => {
    expect(hireFailureReason({ code: "employeesCreate.notFound" })).toBe(
      "accountNotFound",
    );
    expect(hireFailureReason({ code: "employeesCreate.conflict" })).toBe(
      "alreadyMember",
    );
    expect(
      hireFailureReason({ code: "employeesCreate.forbidden" }),
    ).toBe("forbidden");
    expect(
      hireFailureReason({ code: "employeesCreate.validation" }),
    ).toBe("validation");
    expect(hireFailureReason({ code: "employeesCreate.internal" })).toBe(
      "other",
    );
  });
});

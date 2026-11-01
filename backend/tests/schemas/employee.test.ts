import { describe, it, expect } from "vitest";

import {
  createEmployeeBodySchema,
  employeeByBusinessParamsSchema,
  employeeIdParamsSchema,
  patchEmployeeBodySchema,
} from "restaurant-pos-packages/schemas/employee";

const VALID_ID = "507f1f77bcf86cd799439011";

const validCreate = {
  allEmployeeRoles: JSON.stringify(["Waiter", "Cashier"]),
  employmentStatus: "Active",
  joinDate: "2024-01-15",
  businessId: VALID_ID,
  userEmail: "Employee@Example.com",
};

const { businessId: _omitBusinessId, userEmail: _omitUserEmail, ...rest } =
  validCreate;
const validUpdate = rest;

describe("createEmployeeBodySchema", () => {
  it("accepts the minimal hire fields and treats legacy HR fields as absent", () => {
    const parsed = createEmployeeBodySchema.parse(validCreate);
    expect(parsed.allEmployeeRoles).toEqual(["Waiter", "Cashier"]);
    expect(parsed.employmentStatus).toBe("Active");
    expect(parsed.joinDate).toEqual(new Date("2024-01-15"));
    expect(parsed.businessId).toBe(VALID_ID);
    expect(parsed.taxNumber).toBeUndefined();
    expect(parsed.vacationDaysPerYear).toBeUndefined();
    expect(parsed.contractHoursWeek).toBeUndefined();
    expect(parsed.salary).toBeUndefined();
    expect(parsed.comments).toBeUndefined();
  });

  it("coerces the optional numeric vacation allowance and rejects a non-positive value", () => {
    expect(
      createEmployeeBodySchema.parse({ ...validCreate, vacationDaysPerYear: "15" })
        .vacationDaysPerYear,
    ).toBe(15);

    expect(
      createEmployeeBodySchema.safeParse({
        ...validCreate,
        vacationDaysPerYear: "0",
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown employment status", () => {
    expect(
      createEmployeeBodySchema.safeParse({
        ...validCreate,
        employmentStatus: "Fired",
      }).success,
    ).toBe(false);
  });

  it("parses and validates the JSON-encoded allEmployeeRoles", () => {
    expect(
      createEmployeeBodySchema.parse({
        ...validCreate,
        allEmployeeRoles: JSON.stringify(["Waiter"]),
      }).allEmployeeRoles,
    ).toEqual(["Waiter"]);

    for (const roles of ["[]", JSON.stringify(["InvalidRole"]), "{not json"]) {
      expect(
        createEmployeeBodySchema.safeParse({
          ...validCreate,
          allEmployeeRoles: roles,
        }).success,
        roles,
      ).toBe(false);
    }
  });

  it("parses the JSON-encoded salary and treats a blank one as absent", () => {
    const parsed = createEmployeeBodySchema.parse({
      ...validCreate,
      salary: JSON.stringify({
        payFrequency: "Hourly",
        grossSalary: 20,
        netSalary: 15,
      }),
    });
    expect(parsed.salary).toEqual({
      payFrequency: "Hourly",
      grossSalary: 20,
      netSalary: 15,
    });

    expect(
      createEmployeeBodySchema.parse({ ...validCreate, salary: "  " }).salary,
    ).toBeUndefined();

    expect(
      createEmployeeBodySchema.safeParse({ ...validCreate, salary: "{not json" })
        .success,
    ).toBe(false);
  });

  it("rejects a partial, unknown-key, non-numeric or invalid-frequency salary", () => {
    for (const salary of [
      { payFrequency: "Hourly", grossSalary: 20 },
      { payFrequency: "Hourly", grossSalary: 20, netSalary: 15, bonus: 1 },
      { payFrequency: "Hourly", grossSalary: "20", netSalary: 15 },
      { payFrequency: "Fortnightly", grossSalary: 20, netSalary: 15 },
    ]) {
      expect(
        createEmployeeBodySchema.safeParse({
          ...validCreate,
          salary: JSON.stringify(salary),
        }).success,
        JSON.stringify(salary),
      ).toBe(false);
    }
  });

  it("normalizes the email, sanitizes the tax number and strips markup from comments", () => {
    const parsed = createEmployeeBodySchema.parse({
      ...validCreate,
      taxNumber: "  <b>EMP-001</b> ",
      userEmail: " Employee@Example.com ",
      comments: "  <b>Good</b>\n\n\nworker  ",
    });
    expect(parsed.taxNumber).toBe("EMP-001");
    expect(parsed.userEmail).toBe("employee@example.com");
    expect(parsed.comments).toBe("Good\n\nworker");
  });

  it("treats blank optional fields as not provided", () => {
    const parsed = createEmployeeBodySchema.parse({
      ...validCreate,
      taxNumber: "",
      vacationDaysPerYear: "",
      contractHoursWeek: "",
      salary: "",
      comments: "",
    });
    expect(parsed.taxNumber).toBeUndefined();
    expect(parsed.vacationDaysPerYear).toBeUndefined();
    expect(parsed.contractHoursWeek).toBeUndefined();
    expect(parsed.salary).toBeUndefined();
    expect(parsed.comments).toBeUndefined();
  });

  it("rejects a missing required field, an invalid email and an invalid id", () => {
    const { employmentStatus: _drop, ...withoutStatus } = validCreate;
    expect(createEmployeeBodySchema.safeParse(withoutStatus).success).toBe(
      false,
    );

    expect(
      createEmployeeBodySchema.safeParse({
        ...validCreate,
        userEmail: "not-an-email",
      }).success,
    ).toBe(false);
    expect(
      createEmployeeBodySchema.safeParse({
        ...validCreate,
        businessId: "invalid-id",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown keys and server-owned fields", () => {
    expect(
      createEmployeeBodySchema.safeParse({ ...validCreate, isAdmin: true })
        .success,
    ).toBe(false);

    for (const field of [
      "documentsUrl",
      "vacationDaysLeft",
      "userId",
      "active",
      "terminatedDate",
    ]) {
      expect(
        createEmployeeBodySchema.safeParse({ ...validCreate, [field]: "x" })
          .success,
        field,
      ).toBe(false);
    }
  });
});

describe("patchEmployeeBodySchema", () => {
  it("accepts the core fields and treats legacy HR fields as optional", () => {
    const parsed = patchEmployeeBodySchema.parse(validUpdate);
    expect(parsed.employmentStatus).toBe("Active");
    expect(parsed.taxNumber).toBeUndefined();
    expect(parsed.vacationDaysPerYear).toBeUndefined();
    expect(parsed.terminatedDate).toBeUndefined();
  });

  it("requires employmentStatus", () => {
    const { employmentStatus: _drop, ...withoutStatus } = validUpdate;
    expect(patchEmployeeBodySchema.safeParse(withoutStatus).success).toBe(false);
  });

  it("parses terminatedDate and rejects an unknown status", () => {
    expect(
      patchEmployeeBodySchema.parse({
        ...validUpdate,
        terminatedDate: "2024-06-01",
      }).terminatedDate,
    ).toEqual(new Date("2024-06-01"));
    expect(
      patchEmployeeBodySchema.safeParse({
        ...validUpdate,
        employmentStatus: "Fired",
      }).success,
    ).toBe(false);
  });

  it("does not accept businessId, userEmail, active or unknown keys", () => {
    for (const field of [
      "businessId",
      "userEmail",
      "active",
      "isAdmin",
    ]) {
      expect(
        patchEmployeeBodySchema.safeParse({
          ...validUpdate,
          [field]: field === "businessId" ? VALID_ID : "x",
        }).success,
        field,
      ).toBe(false);
    }
  });
});

describe("employee path params", () => {
  it("accept a valid ObjectId and reject a malformed one", () => {
    expect(
      employeeIdParamsSchema.safeParse({ employeeId: VALID_ID }).success,
    ).toBe(true);
    expect(
      employeeIdParamsSchema.safeParse({ employeeId: "invalid-id" }).success,
    ).toBe(false);

    expect(
      employeeByBusinessParamsSchema.safeParse({ businessId: VALID_ID }).success,
    ).toBe(true);
    expect(
      employeeByBusinessParamsSchema.safeParse({ businessId: "invalid-id" })
        .success,
    ).toBe(false);
  });

  it("reject unknown keys", () => {
    expect(
      employeeIdParamsSchema.safeParse({ employeeId: VALID_ID, extra: "x" })
        .success,
    ).toBe(false);
  });
});

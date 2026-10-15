import { describe, it, expect } from "vitest";

import {
  createEmployeeBodySchema,
  employeeByBusinessParamsSchema,
  employeeIdParamsSchema,
  patchEmployeeBodySchema,
} from "domain/schemas/employee";

const VALID_ID = "507f1f77bcf86cd799439011";

const validCreate = {
  allEmployeeRoles: JSON.stringify(["Waiter", "Cashier"]),
  taxNumber: "EMP-001",
  joinDate: "2024-01-15",
  vacationDaysPerYear: "20",
  businessId: VALID_ID,
  userEmail: "Employee@Example.com",
};

const { businessId: _omitBusinessId, ...rest } = validCreate;
const validUpdate = { ...rest, active: "true" };

describe("createEmployeeBodySchema", () => {
  it("accepts the required fields and treats the optional ones as absent", () => {
    const parsed = createEmployeeBodySchema.parse(validCreate);
    expect(parsed.allEmployeeRoles).toEqual(["Waiter", "Cashier"]);
    expect(parsed.taxNumber).toBe("EMP-001");
    expect(parsed.joinDate).toEqual(new Date("2024-01-15"));
    expect(parsed.vacationDaysPerYear).toBe(20);
    expect(parsed.businessId).toBe(VALID_ID);
    expect(parsed.contractHoursWeek).toBeUndefined();
    expect(parsed.salary).toBeUndefined();
    expect(parsed.comments).toBeUndefined();
  });

  it("coerces the numeric form string and rejects a non-positive value", () => {
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
      contractHoursWeek: "",
      salary: "",
      comments: "",
    });
    expect(parsed.contractHoursWeek).toBeUndefined();
    expect(parsed.salary).toBeUndefined();
    expect(parsed.comments).toBeUndefined();
  });

  it("rejects a missing required field, an invalid email and an invalid id", () => {
    const { taxNumber: _drop, ...withoutTaxNumber } = validCreate;
    expect(
      createEmployeeBodySchema.safeParse(withoutTaxNumber).success,
    ).toBe(false);

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

    for (const field of ["documentsUrl", "vacationDaysLeft", "userId", "active"]) {
      expect(
        createEmployeeBodySchema.safeParse({ ...validCreate, [field]: "x" })
          .success,
        field,
      ).toBe(false);
    }
  });
});

describe("patchEmployeeBodySchema", () => {
  it("accepts the core fields, coerces active and treats terminatedDate as absent", () => {
    const parsed = patchEmployeeBodySchema.parse(validUpdate);
    expect(parsed.taxNumber).toBe("EMP-001");
    expect(parsed.active).toBe(true);
    expect(parsed.terminatedDate).toBeUndefined();
  });

  it("requires active", () => {
    const { active: _drop, ...withoutActive } = validUpdate;
    expect(patchEmployeeBodySchema.safeParse(withoutActive).success).toBe(false);
  });

  it("coerces active from its form string and parses terminatedDate", () => {
    expect(
      patchEmployeeBodySchema.parse({ ...validUpdate, active: "false" }).active,
    ).toBe(false);
    expect(
      patchEmployeeBodySchema.parse({ ...validUpdate, active: "true" }).active,
    ).toBe(true);
    expect(
      patchEmployeeBodySchema.parse({
        ...validUpdate,
        terminatedDate: "2024-06-01",
      }).terminatedDate,
    ).toEqual(new Date("2024-06-01"));
  });

  it("does not accept businessId or unknown keys", () => {
    expect(
      patchEmployeeBodySchema.safeParse({ ...validUpdate, businessId: VALID_ID })
        .success,
    ).toBe(false);
    expect(
      patchEmployeeBodySchema.safeParse({ ...validUpdate, isAdmin: true })
        .success,
    ).toBe(false);
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

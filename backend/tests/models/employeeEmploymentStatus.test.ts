import { beforeAll, describe, expect, it } from "vitest";
import { Types } from "mongoose";

import {
  activeEmploymentStatusEnums,
  employmentStatusEnums,
} from "restaurant-pos-packages/enums";
import Employee from "../../src/models/employee.ts";

const joinDate = new Date("2024-01-15");

type EmployeeOverrides = Partial<{
  businessId: Types.ObjectId;
  userId: Types.ObjectId;
  allEmployeeRoles: string[];
  taxNumber: string;
  joinDate: Date;
  vacationDaysPerYear: number;
  employmentStatus: string;
  active: boolean;
  terminatedDate: Date;
  deleted: boolean;
}>;

function employeeFields(overrides: EmployeeOverrides = {}) {
  return {
    businessId: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    allEmployeeRoles: ["Waiter"],
    taxNumber: `EMP-${new Types.ObjectId()}`,
    joinDate,
    vacationDaysPerYear: 20,
    ...overrides,
  };
}

describe("Employee employment status", () => {
  it("stores the closed employment-status list on the model", () => {
    const schemaType = Employee.schema.path("employmentStatus") as {
      enumValues?: string[];
    };

    expect(schemaType.enumValues).toEqual(employmentStatusEnums);
  });

  it.each(employmentStatusEnums)(
    "derives the active mirror from the %s status",
    async (employmentStatus) => {
      const employee = await Employee.create(
        employeeFields({
          employmentStatus,
          active: employmentStatus === "Suspended",
          ...(employmentStatus === "Terminated"
            ? { terminatedDate: new Date("2024-02-01") }
            : {}),
        }),
      );

      expect(employee.active).toBe(
        activeEmploymentStatusEnums.includes(employmentStatus),
      );
    },
  );

  it("keeps the stored active and terminatedDate behaviour for a legacy row", async () => {
    const terminatedDate = new Date("2024-02-01");
    const employee = await Employee.create(
      employeeFields({ active: false, terminatedDate }),
    );

    expect(employee.employmentStatus).toBeUndefined();
    expect(employee.active).toBe(false);
    expect(employee.terminatedDate).toEqual(terminatedDate);
  });

  it("requires a termination date for a Terminated membership", async () => {
    await expect(
      Employee.create(employeeFields({ employmentStatus: "Terminated" })),
    ).rejects.toThrow(/Termination date is required/);
  });

  it("clears the termination date for every non-Terminated status", async () => {
    const employee = await Employee.create(
      employeeFields({
        employmentStatus: "Active",
        terminatedDate: new Date("2024-02-01"),
      }),
    );

    expect(employee.terminatedDate).toBeUndefined();
  });

  it("accepts a termination date equal to the join date", async () => {
    const employee = await Employee.create(
      employeeFields({
        employmentStatus: "Terminated",
        terminatedDate: joinDate,
      }),
    );

    expect(employee.terminatedDate).toEqual(joinDate);
  });

  it("refuses a termination date before the join date", async () => {
    await expect(
      Employee.create(
        employeeFields({
          employmentStatus: "Terminated",
          terminatedDate: new Date("2024-01-14"),
        }),
      ),
    ).rejects.toThrow(/on or after join date/);
  });

  it("derives active and clears the termination date on a query update", async () => {
    const employee = await Employee.create(employeeFields());

    await Employee.updateOne(
      { _id: employee._id },
      { $set: { employmentStatus: "Suspended" } },
    );
    let stored = await Employee.findById(employee._id).lean();
    expect(stored?.active).toBe(false);
    expect(stored?.employmentStatus).toBe("Suspended");

    await Employee.updateOne(
      { _id: employee._id },
      {
        $set: {
          employmentStatus: "Terminated",
          terminatedDate: new Date("2024-02-01"),
        },
      },
    );
    stored = await Employee.findById(employee._id).lean();
    expect(stored?.active).toBe(false);
    expect(stored?.terminatedDate).toEqual(new Date("2024-02-01"));

    await Employee.updateOne(
      { _id: employee._id },
      { $set: { employmentStatus: "Seasonal" } },
    );
    stored = await Employee.findById(employee._id).lean();
    expect(stored?.active).toBe(true);
    expect(stored?.terminatedDate ?? undefined).toBeUndefined();
  });
});

describe("Employee membership uniqueness", () => {
  beforeAll(async () => {
    await Employee.syncIndexes();
  });

  it("refuses a second non-deleted membership for the same User and Business", async () => {
    const businessId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    await Employee.create(employeeFields({ businessId, userId }));

    await expect(
      Employee.create(employeeFields({ businessId, userId })),
    ).rejects.toThrow(/duplicate key/i);
  });

  it("allows a new membership after the previous one is soft-deleted", async () => {
    const businessId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    await Employee.create(
      employeeFields({ businessId, userId, deleted: true }),
    );

    const replacement = await Employee.create(
      employeeFields({ businessId, userId }),
    );

    expect(String(replacement.businessId)).toBe(String(businessId));
    expect(String(replacement.userId)).toBe(String(userId));
  });

  it("scopes the tax-number uniqueness to one Business", async () => {
    const taxNumber = `EMP-${new Types.ObjectId()}`;
    const userId = new Types.ObjectId();
    const businessId = new Types.ObjectId();
    await Employee.create(
      employeeFields({ businessId, userId, taxNumber }),
    );

    await expect(
      Employee.create(
        employeeFields({
          businessId,
          userId: new Types.ObjectId(),
          taxNumber,
        }),
      ),
    ).rejects.toThrow(/duplicate key/i);

    const otherBusiness = new Types.ObjectId();
    const sameTaxElsewhere = await Employee.create(
      employeeFields({
        businessId: otherBusiness,
        userId,
        taxNumber,
      }),
    );
    expect(sameTaxElsewhere.taxNumber).toBe(taxNumber);
  });
});

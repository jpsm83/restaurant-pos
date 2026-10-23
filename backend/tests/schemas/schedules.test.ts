import { describe, it, expect } from "vitest";

import {
  addEmployeeBodySchema,
  createScheduleBodySchema,
  dailyScheduleQuerySchema,
  deleteEmployeeBodySchema,
  employeeScheduleSchema,
  scheduleBusinessParamsSchema,
  scheduleIdParamsSchema,
  schedulesIncludeDeletedQuerySchema,
  scheduleUserParamsSchema,
  updateEmployeeBodySchema,
  updateScheduleBodySchema,
} from "restaurant-pos-packages/schemas/schedules";
import {
  employeeScheduleServerOwnedFields,
  scheduleDtoSchemas,
  scheduleServerOwnedFields,
} from "../helpers/scheduleDtos.ts";

const VALID_ID = "507f1f77bcf86cd799439011";
const SECOND_ID = "507f1f77bcf86cd799439022";

const validEmployeeSchedule = {
  employeeId: VALID_ID,
  role: "Waiter",
  timeRange: {
    startTime: "2025-01-15T09:00:00.000Z",
    endTime: "2025-01-15T17:00:00.000Z",
  },
};

describe("createScheduleBodySchema", () => {
  it("accepts the minimum required fields", () => {
    expect(
      createScheduleBodySchema.safeParse({
        date: "2025-01-15T00:00:00.000Z",
        businessId: VALID_ID,
      }).success,
    ).toBe(true);
  });

  it("coerces date strings into Date objects", () => {
    const parsed = createScheduleBodySchema.parse({
      date: "2025-01-15T00:00:00.000Z",
      businessId: VALID_ID,
    });
    expect(parsed.date).toBeInstanceOf(Date);
  });

  it("accepts a Date object", () => {
    const parsed = createScheduleBodySchema.parse({
      date: new Date("2025-01-15T00:00:00.000Z"),
      businessId: VALID_ID,
    });
    expect(parsed.date).toBeInstanceOf(Date);
  });

  it("requires date and businessId", () => {
    expect(createScheduleBodySchema.safeParse({}).success).toBe(false);
    expect(
      createScheduleBodySchema.safeParse({ businessId: VALID_ID }).success,
    ).toBe(false);
    expect(
      createScheduleBodySchema.safeParse({ date: "2025-01-15" }).success,
    ).toBe(false);
  });

  it("rejects an invalid date", () => {
    expect(
      createScheduleBodySchema.safeParse({
        date: "not-a-date",
        businessId: VALID_ID,
      }).success,
    ).toBe(false);
  });

  it("trims a businessId and rejects a malformed one", () => {
    const parsed = createScheduleBodySchema.parse({
      date: "2025-01-15",
      businessId: `  ${VALID_ID}  `,
    });
    expect(parsed.businessId).toBe(VALID_ID);
    expect(
      createScheduleBodySchema.safeParse({
        date: "2025-01-15",
        businessId: "invalid-id",
      }).success,
    ).toBe(false);
  });

  it("sanitizes comments (HTML stripped, whitespace collapsed)", () => {
    const parsed = createScheduleBodySchema.parse({
      date: "2025-01-15",
      businessId: VALID_ID,
      comments: "  <b>Party</b>   of 10  ",
    });
    expect(parsed.comments).toBe("Party of 10");
  });

  it("treats comments as optional", () => {
    expect(
      createScheduleBodySchema.safeParse({
        date: "2025-01-15",
        businessId: VALID_ID,
      }).success,
    ).toBe(true);
  });

  it("rejects server-owned fields", () => {
    for (const serverOwned of [
      { weekNumber: 3 },
      { employeesSchedules: [] },
      { totalEmployeesScheduled: 2 },
    ]) {
      expect(
        createScheduleBodySchema.safeParse({
          date: "2025-01-15",
          businessId: VALID_ID,
          ...serverOwned,
        }).success,
      ).toBe(false);
    }
  });

  it("rejects unknown keys", () => {
    expect(
      createScheduleBodySchema.safeParse({
        date: "2025-01-15",
        businessId: VALID_ID,
        isAdmin: true,
      }).success,
    ).toBe(false);
  });
});

describe("schedule path param schemas", () => {
  it.each([
    ["scheduleIdParamsSchema", scheduleIdParamsSchema, "scheduleId"],
    ["scheduleBusinessParamsSchema", scheduleBusinessParamsSchema, "businessId"],
    ["scheduleUserParamsSchema", scheduleUserParamsSchema, "userId"],
  ] as const)("%s accepts a valid ObjectId", (_name, schema, key) => {
    expect(schema.safeParse({ [key]: VALID_ID }).success).toBe(true);
  });

  it.each([
    ["scheduleId", scheduleIdParamsSchema],
    ["businessId", scheduleBusinessParamsSchema],
    ["userId", scheduleUserParamsSchema],
  ] as const)("%s rejects invalid or missing ids", (key, schema) => {
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ [key]: "invalid-id" }).success).toBe(false);
    expect(schema.safeParse({ [key]: VALID_ID, extra: "x" }).success).toBe(false);
  });
});

describe("dailyScheduleQuerySchema", () => {
  it("accepts a YYYY-MM-DD dayKey", () => {
    expect(dailyScheduleQuerySchema.parse({ dayKey: "2026-10-11" }).dayKey).toBe(
      "2026-10-11",
    );
  });

  it("treats a missing dayKey as not provided", () => {
    expect(dailyScheduleQuerySchema.parse({}).dayKey).toBeUndefined();
  });

  it("treats an empty dayKey as not provided", () => {
    expect(dailyScheduleQuerySchema.parse({ dayKey: "   " }).dayKey).toBeUndefined();
  });

  it.each(["2026/10/11", "11-10-2026", "2026-10"])(
    "rejects the malformed dayKey %s",
    (dayKey) => {
      expect(dailyScheduleQuerySchema.safeParse({ dayKey }).success).toBe(false);
    },
  );

  it("rejects unknown keys", () => {
    expect(
      dailyScheduleQuerySchema.safeParse({ dayKey: "2026-10-11", extra: "x" })
        .success,
    ).toBe(false);
  });
});

describe("schedulesIncludeDeletedQuerySchema", () => {
  it("accepts an omitted includeDeleted", () => {
    expect(
      schedulesIncludeDeletedQuerySchema.parse({}).includeDeleted,
    ).toBeUndefined();
  });

  it("treats a blank includeDeleted as omitted", () => {
    expect(
      schedulesIncludeDeletedQuerySchema.parse({ includeDeleted: "" })
        .includeDeleted,
    ).toBeUndefined();
  });

  it("coerces string booleans", () => {
    expect(
      schedulesIncludeDeletedQuerySchema.parse({ includeDeleted: "true" })
        .includeDeleted,
    ).toBe(true);
    expect(
      schedulesIncludeDeletedQuerySchema.parse({ includeDeleted: "false" })
        .includeDeleted,
    ).toBe(false);
  });

  it("rejects a non-boolean includeDeleted and unknown keys", () => {
    expect(
      schedulesIncludeDeletedQuerySchema.safeParse({ includeDeleted: "maybe" })
        .success,
    ).toBe(false);
    expect(
      schedulesIncludeDeletedQuerySchema.safeParse({
        includeDeleted: true,
        createdAt: "x",
      }).success,
    ).toBe(false);
  });
});

describe("employeeScheduleSchema", () => {
  it("accepts the minimum required fields", () => {
    expect(employeeScheduleSchema.safeParse(validEmployeeSchedule).success).toBe(
      true,
    );
  });

  it("coerces the time range strings into Dates", () => {
    const parsed = employeeScheduleSchema.parse(validEmployeeSchedule);
    expect(parsed.timeRange.startTime).toBeInstanceOf(Date);
    expect(parsed.timeRange.endTime).toBeInstanceOf(Date);
  });

  it("coerces a string vacation flag", () => {
    expect(
      employeeScheduleSchema.parse({ ...validEmployeeSchedule, vacation: "true" })
        .vacation,
    ).toBe(true);
    expect(
      employeeScheduleSchema.parse({ ...validEmployeeSchedule, vacation: "off" })
        .vacation,
    ).toBe(false);
  });

  it("sanitizes the role", () => {
    const parsed = employeeScheduleSchema.parse({
      ...validEmployeeSchedule,
      role: "  <i>Head</i>   Chef ",
    });
    expect(parsed.role).toBe("Head Chef");
  });

  it("rejects a missing or empty role", () => {
    expect(
      employeeScheduleSchema.safeParse({
        ...validEmployeeSchedule,
        role: "   ",
      }).success,
    ).toBe(false);
  });

  it("requires employeeId, role and timeRange", () => {
    expect(employeeScheduleSchema.safeParse({}).success).toBe(false);
    expect(
      employeeScheduleSchema.safeParse({ role: "Waiter", timeRange: {} })
        .success,
    ).toBe(false);
  });

  it("rejects a malformed employeeId", () => {
    expect(
      employeeScheduleSchema.safeParse({
        ...validEmployeeSchedule,
        employeeId: "invalid-id",
      }).success,
    ).toBe(false);
  });

  it("rejects server-owned fields", () => {
    for (const serverOwned of [
      { _id: VALID_ID },
      { shiftHours: 28800000 },
      { employeeCost: 120 },
    ]) {
      expect(
        employeeScheduleSchema.safeParse({
          ...validEmployeeSchedule,
          ...serverOwned,
        }).success,
      ).toBe(false);
    }
  });

  it("rejects unknown timeRange keys", () => {
    expect(
      employeeScheduleSchema.safeParse({
        ...validEmployeeSchedule,
        timeRange: { ...validEmployeeSchedule.timeRange, breakTime: 30 },
      }).success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      employeeScheduleSchema.safeParse({
        ...validEmployeeSchedule,
        isAdmin: true,
      }).success,
    ).toBe(false);
  });
});

describe("updateScheduleBodySchema", () => {
  it("accepts an empty update", () => {
    expect(updateScheduleBodySchema.safeParse({}).success).toBe(true);
  });

  it("sanitizes updated comments", () => {
    expect(
      updateScheduleBodySchema.parse({ comments: "  <b>New</b>   note " })
        .comments,
    ).toBe("New note");
  });

  it("rejects server-owned fields", () => {
    expect(
      updateScheduleBodySchema.safeParse({ date: "2025-01-15" }).success,
    ).toBe(false);
    expect(
      updateScheduleBodySchema.safeParse({ businessId: VALID_ID }).success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      updateScheduleBodySchema.safeParse({ isAdmin: true }).success,
    ).toBe(false);
  });
});

describe("schedule employee-management body schemas", () => {
  it("addEmployeeBodySchema requires a valid employeeSchedule", () => {
    expect(
      addEmployeeBodySchema.safeParse({
        employeeSchedule: validEmployeeSchedule,
      }).success,
    ).toBe(true);
    expect(addEmployeeBodySchema.safeParse({}).success).toBe(false);
  });

  it("updateEmployeeBodySchema requires employeeSchedule and employeeScheduleId", () => {
    expect(
      updateEmployeeBodySchema.safeParse({
        employeeSchedule: validEmployeeSchedule,
        employeeScheduleId: SECOND_ID,
      }).success,
    ).toBe(true);
    expect(
      updateEmployeeBodySchema.safeParse({
        employeeSchedule: validEmployeeSchedule,
      }).success,
    ).toBe(false);
    expect(
      updateEmployeeBodySchema.safeParse({
        employeeSchedule: validEmployeeSchedule,
        employeeScheduleId: "invalid-id",
      }).success,
    ).toBe(false);
  });

  it("deleteEmployeeBodySchema requires two ObjectIds", () => {
    expect(
      deleteEmployeeBodySchema.safeParse({
        employeeId: VALID_ID,
        employeeScheduleId: SECOND_ID,
      }).success,
    ).toBe(true);
    expect(
      deleteEmployeeBodySchema.safeParse({ employeeId: VALID_ID }).success,
    ).toBe(false);
    expect(
      deleteEmployeeBodySchema.safeParse({
        employeeId: "invalid",
        employeeScheduleId: SECOND_ID,
      }).success,
    ).toBe(false);
  });

  it("rejects unknown keys on every body", () => {
    expect(
      addEmployeeBodySchema.safeParse({
        employeeSchedule: validEmployeeSchedule,
        isAdmin: true,
      }).success,
    ).toBe(false);
    expect(
      updateEmployeeBodySchema.safeParse({
        employeeSchedule: validEmployeeSchedule,
        employeeScheduleId: SECOND_ID,
        isAdmin: true,
      }).success,
    ).toBe(false);
    expect(
      deleteEmployeeBodySchema.safeParse({
        employeeId: VALID_ID,
        employeeScheduleId: SECOND_ID,
        isAdmin: true,
      }).success,
    ).toBe(false);
  });
});

describe("server-owned fields are excluded from every schedules DTO", () => {
  const serverOwned = [
    ...scheduleServerOwnedFields,
    ...employeeScheduleServerOwnedFields,
  ];

  it.each(Object.entries(scheduleDtoSchemas))(
    "%s has no server-owned key",
    (_name, schema) => {
      const keys = Object.keys(schema.shape);
      for (const field of serverOwned) {
        expect(keys).not.toContain(field);
      }
    },
  );
});

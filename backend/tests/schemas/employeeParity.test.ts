import { describe, it, expect } from "vitest";
import type { z } from "zod";

import Employee from "../../src/models/employee.ts";
import {
  createEmployeeBodySchema,
  employeeByBusinessParamsSchema,
  employeeIdParamsSchema,
  patchEmployeeBodySchema,
} from "restaurant-pos-packages/schemas/employee";

/**
 * Parity between the employee DTOs and the Mongoose Employee model (the domain
 * source of truth): every domain field a client may send must exist on the
 * model, and every server-owned field must exist on the model but never in a
 * DTO.
 */

const allDtos: Record<string, z.ZodObject> = {
  createEmployeeBodySchema,
  patchEmployeeBodySchema,
  employeeIdParamsSchema,
  employeeByBusinessParamsSchema,
};

const employeeOwns = (field: string): boolean =>
  Boolean(Employee.schema.path(field));

/**
 * `userEmail` is a create-only lookup key: the client identifies the linking
 * User by email, the route stores the resolved `userId`, and update cannot
 * rebind the membership.
 */
const requestOnlyFields = new Set(["userEmail"]);

describe("employee DTO ↔ model parity", () => {
  it("every create/update body field maps to an Employee model field", () => {
    for (const schema of [createEmployeeBodySchema, patchEmployeeBodySchema]) {
      for (const key of Object.keys(schema.shape)) {
        if (requestOnlyFields.has(key)) continue;
        expect(
          employeeOwns(key),
          `${key} should map to an Employee model field`,
        ).toBe(true);
      }
    }
  });

  it("userEmail is a create-only lookup key, not an Employee field", () => {
    expect(employeeOwns("userEmail")).toBe(false);
    expect(Object.keys(createEmployeeBodySchema.shape)).toContain("userEmail");
    expect(Object.keys(patchEmployeeBodySchema.shape)).not.toContain(
      "userEmail",
    );
  });

  it("create requires businessId while update omits it", () => {
    expect(employeeOwns("businessId")).toBe(true);
    expect(Object.keys(createEmployeeBodySchema.shape)).toContain("businessId");
    expect(Object.keys(patchEmployeeBodySchema.shape)).not.toContain(
      "businessId",
    );
  });

  it("employmentStatus is client-settable while active is server-owned", () => {
    expect(employeeOwns("employmentStatus")).toBe(true);
    expect(employeeOwns("active")).toBe(true);
    for (const schema of [createEmployeeBodySchema, patchEmployeeBodySchema]) {
      expect(Object.keys(schema.shape)).toContain("employmentStatus");
      expect(Object.keys(schema.shape)).not.toContain("active");
    }
  });

  it("legacy HR fields are optional in both DTOs", () => {
    for (const field of ["taxNumber", "vacationDaysPerYear"]) {
      expect(employeeOwns(field), `${field} should be on the model`).toBe(true);
      for (const schema of [
        createEmployeeBodySchema,
        patchEmployeeBodySchema,
      ]) {
        expect(Object.keys(schema.shape)).toContain(field);
      }
    }

    expect(
      createEmployeeBodySchema.safeParse({
        allEmployeeRoles: JSON.stringify(["Waiter"]),
        employmentStatus: "Active",
        joinDate: "2024-01-15",
        businessId: "507f1f77bcf86cd799439011",
        userEmail: "employee@example.com",
      }).success,
    ).toBe(true);
    expect(
      patchEmployeeBodySchema.safeParse({
        allEmployeeRoles: JSON.stringify(["Waiter"]),
        employmentStatus: "Active",
        joinDate: "2024-01-15",
      }).success,
    ).toBe(true);
  });

  it("server-owned fields are on the model but in no DTO", () => {
    for (const field of [
      "userId",
      "documentsUrl",
      "vacationDaysLeft",
      "onDuty",
      "currentShiftRole",
      "active",
    ]) {
      expect(employeeOwns(field), `${field} should be on the model`).toBe(true);
      for (const [name, schema] of Object.entries(allDtos)) {
        expect(
          Object.keys(schema.shape),
          `${name} should not accept ${field}`,
        ).not.toContain(field);
      }
    }
  });
});

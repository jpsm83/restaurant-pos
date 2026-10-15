import { describe, it, expect } from "vitest";
import type { z } from "zod";

import Employee from "../../src/models/employee.ts";
import {
  createEmployeeBodySchema,
  employeeByBusinessParamsSchema,
  employeeIdParamsSchema,
  patchEmployeeBodySchema,
} from "domain/schemas/employee";

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
 * `userEmail` is a request-only lookup key: the client identifies the linking
 * User by email, and the route stores the resolved `userId` instead.
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

  it("userEmail is a request-only lookup key, not an Employee field", () => {
    expect(employeeOwns("userEmail")).toBe(false);
    expect(Object.keys(createEmployeeBodySchema.shape)).toContain("userEmail");
    expect(Object.keys(patchEmployeeBodySchema.shape)).toContain("userEmail");
  });

  it("create requires businessId while update omits it", () => {
    expect(employeeOwns("businessId")).toBe(true);
    expect(Object.keys(createEmployeeBodySchema.shape)).toContain("businessId");
    expect(Object.keys(patchEmployeeBodySchema.shape)).not.toContain(
      "businessId",
    );
  });

  it("active is client-settable on update but not on create", () => {
    expect(employeeOwns("active")).toBe(true);
    expect(Object.keys(patchEmployeeBodySchema.shape)).toContain("active");
    expect(Object.keys(createEmployeeBodySchema.shape)).not.toContain("active");
  });

  it("server-owned fields are on the model but in no DTO", () => {
    for (const field of [
      "userId",
      "documentsUrl",
      "vacationDaysLeft",
      "onDuty",
      "currentShiftRole",
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

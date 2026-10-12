import { describe, it, expect } from "vitest";

import Schedule from "../../src/models/schedule.ts";
import {
  createScheduleBodySchema,
  employeeScheduleSchema,
  updateScheduleBodySchema,
} from "restaurant-pos-packages/schemas/schedules";
import {
  employeeScheduleServerOwnedFields,
  scheduleDtoSchemas,
  scheduleServerOwnedFields,
} from "../helpers/scheduleDtos.ts";

/**
 * Parity between the schedules DTOs and the Schedule model (the domain source of
 * truth): every field a client may send must exist on the model, and every
 * server-owned field must exist on the model but never in a DTO.
 */

const scheduleOwns = (field: string): boolean =>
  Boolean(Schedule.schema.path(field));

describe("schedules DTO ↔ model parity", () => {
  it("every create-schedule field maps to a Schedule model field", () => {
    for (const key of Object.keys(createScheduleBodySchema.shape)) {
      expect(
        scheduleOwns(key),
        `createSchedule.${key} should map to a model field`,
      ).toBe(true);
    }
  });

  it("every update-schedule field maps to a Schedule model field", () => {
    for (const key of Object.keys(updateScheduleBodySchema.shape)) {
      expect(
        scheduleOwns(key),
        `updateSchedule.${key} should map to a model field`,
      ).toBe(true);
    }
  });

  it("every employeeSchedule field maps to a nested model field", () => {
    expect(scheduleOwns("employeesSchedules")).toBe(true);
    for (const key of Object.keys(employeeScheduleSchema.shape)) {
      if (key === "timeRange") {
        expect(scheduleOwns("employeesSchedules.timeRange.startTime")).toBe(
          true,
        );
        expect(scheduleOwns("employeesSchedules.timeRange.endTime")).toBe(true);
        continue;
      }
      expect(
        scheduleOwns(`employeesSchedules.${key}`),
        `employeeSchedule.${key} should map to a nested model field`,
      ).toBe(true);
    }
  });

  it("server-owned fields are owned by Schedule but accepted by no DTO", () => {
    for (const field of scheduleServerOwnedFields) {
      expect(scheduleOwns(field), `${field} should be owned by Schedule`).toBe(
        true,
      );
      for (const [name, schema] of Object.entries(scheduleDtoSchemas)) {
        expect(
          Object.keys(schema.shape),
          `${name} should not accept ${field}`,
        ).not.toContain(field);
      }
    }
  });

  it("computed employeeSchedule fields are owned by Schedule but accepted by no DTO", () => {
    for (const field of employeeScheduleServerOwnedFields) {
      expect(
        scheduleOwns(`employeesSchedules.${field}`),
        `${field} should be owned by Schedule`,
      ).toBe(true);
      expect(Object.keys(employeeScheduleSchema.shape)).not.toContain(field);
    }
  });

  it("the DTO ObjectId relations map to model ObjectId paths", () => {
    expect(scheduleOwns("businessId")).toBe(true);
    expect(scheduleOwns("employeesSchedules.employeeId")).toBe(true);
  });
});

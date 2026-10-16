import { describe, it, expect } from "vitest";

import Reservation from "../../src/models/reservation.ts";
import { reservationStatusEnums } from "restaurant-pos-packages/enums";
import {
  createReservationBodySchema,
  updateReservationBodySchema,
} from "restaurant-pos-packages/schemas/reservations";
import { reservationDtoSchemas } from "../helpers/reservationDtos.ts";

/**
 * Parity between the reservations DTOs and the Reservation model (the domain
 * source of truth): every field a client may send must exist on the model, and
 * every server-owned field must exist on the model but never in a DTO.
 */

const VALID_ID = "507f1f77bcf86cd799439011";

const reservationOwns = (field: string): boolean =>
  Boolean(Reservation.schema.path(field));

describe("reservations DTO ↔ model parity", () => {
  it("every create-reservation field maps to a Reservation model field", () => {
    for (const key of Object.keys(createReservationBodySchema.shape)) {
      expect(
        reservationOwns(key),
        `createReservation.${key} should map to a model field`,
      ).toBe(true);
    }
  });

  it("every update-reservation field maps to a Reservation model field", () => {
    for (const key of Object.keys(updateReservationBodySchema.shape)) {
      expect(
        reservationOwns(key),
        `updateReservation.${key} should map to a model field`,
      ).toBe(true);
    }
  });

  it("server-owned fields are owned by Reservation but accepted by no DTO", () => {
    for (const field of [
      "createdByUserId",
      "createdByRole",
      "salesInstanceId",
      "createdAt",
      "updatedAt",
    ]) {
      expect(
        reservationOwns(field),
        `${field} should be owned by Reservation`,
      ).toBe(true);
      for (const [name, schema] of Object.entries(reservationDtoSchemas)) {
        expect(
          Object.keys(schema.shape),
          `${name} should not accept ${field}`,
        ).not.toContain(field);
      }
    }
  });

  it("the DTO status accepts every value of the shared enum", () => {
    for (const status of reservationStatusEnums) {
      const result = updateReservationBodySchema.safeParse({ status });
      expect(result.success, `status ${status} should be accepted`).toBe(true);
    }
  });

  it("the DTO status rejects a value outside the shared enum", () => {
    const result = updateReservationBodySchema.safeParse({ status: "Bogus" });
    expect(result.success).toBe(false);
  });

  it("the DTO guestCount is a numeric field on the model", () => {
    expect(reservationOwns("guestCount")).toBe(true);
    const result = createReservationBodySchema.safeParse({
      businessId: VALID_ID,
      guestCount: "3",
      reservationStart: "2024-06-15T19:00:00Z",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.guestCount).toBe(3);
  });

  it("the DTO ObjectId relations map to model ObjectId paths", () => {
    for (const field of [
      "businessId",
      "employeeResponsableByUserId",
      "salesPointId",
    ]) {
      expect(
        reservationOwns(field),
        `${field} should be owned by Reservation`,
      ).toBe(true);
    }
  });
});

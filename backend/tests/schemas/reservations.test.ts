import { describe, it, expect } from "vitest";

import {
  createReservationBodySchema,
  reservationIdParamsSchema,
  reservationsByBusinessParamsSchema,
  reservationsByBusinessQuerySchema,
  reservationsQuerySchema,
  reservationStatusValues,
  updateReservationBodySchema,
} from "../../../packages/schemas/reservations.ts";
import { reservationStatusEnums } from "../../../packages/enums.ts";
import { reservationDtoSchemas } from "../helpers/reservationDtos.ts";

const VALID_ID = "507f1f77bcf86cd799439011";

const valid = {
  businessId: VALID_ID,
  guestCount: 4,
  reservationStart: "2024-06-15T19:00:00Z",
};

describe("createReservationBodySchema", () => {
  it("accepts the minimum required fields", () => {
    expect(createReservationBodySchema.safeParse(valid).success).toBe(true);
  });

  it("requires businessId, guestCount and reservationStart", () => {
    expect(createReservationBodySchema.safeParse({}).success).toBe(false);
    for (const key of ["businessId", "guestCount", "reservationStart"]) {
      const without = { ...valid } as Record<string, unknown>;
      delete without[key];
      expect(
        createReservationBodySchema.safeParse(without).success,
        `${key} should be required`,
      ).toBe(false);
    }
  });

  it("coerces reservationStart to a Date", () => {
    const parsed = createReservationBodySchema.parse(valid);
    expect(parsed.reservationStart).toBeInstanceOf(Date);
  });

  it("accepts an optional reservationEnd and coerces it", () => {
    const parsed = createReservationBodySchema.parse({
      ...valid,
      reservationEnd: "2024-06-15T21:00:00Z",
    });
    expect(parsed.reservationEnd).toBeInstanceOf(Date);
  });

  it("accepts a reservationEnd not after reservationStart (rule enforced post-parse)", () => {
    expect(
      createReservationBodySchema.safeParse({
        ...valid,
        reservationEnd: "2024-06-15T18:00:00Z",
      }).success,
    ).toBe(true);
  });

  it("rejects a malformed date", () => {
    expect(
      createReservationBodySchema.safeParse({
        ...valid,
        reservationStart: "not-a-date",
      }).success,
    ).toBe(false);
  });

  it("accepts a positive integer guestCount and coerces numeric strings", () => {
    expect(
      createReservationBodySchema.safeParse({ ...valid, guestCount: 6 }).success,
    ).toBe(true);
    const parsed = createReservationBodySchema.parse({
      ...valid,
      guestCount: "6",
    });
    expect(parsed.guestCount).toBe(6);
  });

  it("rejects a zero, negative or non-integer guestCount", () => {
    for (const guestCount of [0, -1, 2.5]) {
      expect(
        createReservationBodySchema.safeParse({ ...valid, guestCount }).success,
        `guestCount ${guestCount} should be rejected`,
      ).toBe(false);
    }
  });

  it("rejects an invalid businessId", () => {
    expect(
      createReservationBodySchema.safeParse({ ...valid, businessId: "nope" })
        .success,
    ).toBe(false);
  });

  it("sanitizes the description (HTML stripped, whitespace collapsed)", () => {
    const parsed = createReservationBodySchema.parse({
      ...valid,
      description: "  <b>Birthday</b>   dinner  ",
    });
    expect(parsed.description).toBe("Birthday dinner");
  });

  it("rejects unknown keys", () => {
    expect(
      createReservationBodySchema.safeParse({ ...valid, isAdmin: true }).success,
    ).toBe(false);
  });

  it("rejects a client-supplied server-owned key", () => {
    for (const key of ["createdByUserId", "createdByRole", "status"]) {
      expect(
        createReservationBodySchema.safeParse({
          ...valid,
          [key]: VALID_ID,
        }).success,
        `${key} should not be accepted`,
      ).toBe(false);
    }
  });
});

describe("updateReservationBodySchema", () => {
  it("accepts an empty update", () => {
    expect(updateReservationBodySchema.safeParse({}).success).toBe(true);
  });

  it("accepts every reservation status from the shared enum", () => {
    for (const status of reservationStatusEnums) {
      expect(
        updateReservationBodySchema.safeParse({ status }).success,
        `status ${status} should be accepted`,
      ).toBe(true);
    }
  });

  it("rejects a status outside the shared enum", () => {
    expect(
      updateReservationBodySchema.safeParse({ status: "Bogus" }).success,
    ).toBe(false);
  });

  it("accepts client-settable ObjectId relations", () => {
    const parsed = updateReservationBodySchema.parse({
      salesPointId: VALID_ID,
      employeeResponsableByUserId: VALID_ID,
    });
    expect(parsed.salesPointId).toBe(VALID_ID);
    expect(parsed.employeeResponsableByUserId).toBe(VALID_ID);
  });

  it("rejects a salesInstanceId (server-owned during the seat flow)", () => {
    expect(
      updateReservationBodySchema.safeParse({ salesInstanceId: VALID_ID })
        .success,
    ).toBe(false);
  });

  it("rejects a malformed ObjectId relation", () => {
    expect(
      updateReservationBodySchema.safeParse({ salesPointId: "nope" }).success,
    ).toBe(false);
  });

  it("sanitizes the description and coerces dates", () => {
    const parsed = updateReservationBodySchema.parse({
      reservationStart: "2024-06-15T19:00:00Z",
      description: "  <i>Late</i>   dinner ",
    });
    expect(parsed.reservationStart).toBeInstanceOf(Date);
    expect(parsed.description).toBe("Late dinner");
  });

  it("rejects a businessId (not client-settable on update)", () => {
    expect(
      updateReservationBodySchema.safeParse({ businessId: VALID_ID }).success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      updateReservationBodySchema.safeParse({ isAdmin: true }).success,
    ).toBe(false);
  });
});

describe("reservationIdParamsSchema", () => {
  it("accepts a valid ObjectId", () => {
    expect(
      reservationIdParamsSchema.safeParse({ reservationId: VALID_ID }).success,
    ).toBe(true);
  });

  it.each([{}, { reservationId: "invalid-id" }])("rejects %j", (params) => {
    expect(reservationIdParamsSchema.safeParse(params).success).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      reservationIdParamsSchema.safeParse({
        reservationId: VALID_ID,
        extra: "x",
      }).success,
    ).toBe(false);
  });
});

describe("reservationsQuerySchema", () => {
  it("accepts an empty query", () => {
    expect(reservationsQuerySchema.safeParse({}).success).toBe(true);
  });

  it("accepts an optional businessId and rejects a malformed one", () => {
    expect(
      reservationsQuerySchema.safeParse({ businessId: VALID_ID }).success,
    ).toBe(true);
    expect(
      reservationsQuerySchema.safeParse({ businessId: "nope" }).success,
    ).toBe(false);
  });

  it("coerces the start and end dates", () => {
    const parsed = reservationsQuerySchema.parse({
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });
    expect(parsed.startDate).toBeInstanceOf(Date);
    expect(parsed.endDate).toBeInstanceOf(Date);
  });

  it("treats an empty date string as not provided", () => {
    const parsed = reservationsQuerySchema.parse({ startDate: "", endDate: "" });
    expect(parsed.startDate).toBeUndefined();
    expect(parsed.endDate).toBeUndefined();
  });

  it("rejects a malformed date", () => {
    expect(
      reservationsQuerySchema.safeParse({ startDate: "not-a-date" }).success,
    ).toBe(false);
  });

  it("accepts every status from the shared enum and rejects others", () => {
    for (const status of reservationStatusEnums) {
      expect(reservationsQuerySchema.safeParse({ status }).success).toBe(true);
    }
    expect(reservationsQuerySchema.safeParse({ status: "Bogus" }).success).toBe(
      false,
    );
  });

  it("accepts an inverted date range (rule enforced in the route)", () => {
    expect(
      reservationsQuerySchema.safeParse({
        startDate: "2024-12-31",
        endDate: "2024-01-01",
      }).success,
    ).toBe(true);
  });

  it("rejects unknown keys", () => {
    expect(reservationsQuerySchema.safeParse({ limit: 10 }).success).toBe(false);
  });
});

describe("reservationsByBusinessParamsSchema", () => {
  it("accepts a valid businessId and rejects a malformed one", () => {
    expect(
      reservationsByBusinessParamsSchema.safeParse({ businessId: VALID_ID })
        .success,
    ).toBe(true);
    expect(
      reservationsByBusinessParamsSchema.safeParse({ businessId: "nope" })
        .success,
    ).toBe(false);
  });
});

describe("reservationsByBusinessQuerySchema", () => {
  it("accepts an empty query", () => {
    expect(reservationsByBusinessQuerySchema.safeParse({}).success).toBe(true);
  });

  it("accepts the status and date filters", () => {
    const parsed = reservationsByBusinessQuerySchema.parse({
      status: "Confirmed",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });
    expect(parsed.status).toBe("Confirmed");
    expect(parsed.startDate).toBeInstanceOf(Date);
    expect(parsed.endDate).toBeInstanceOf(Date);
  });

  it("rejects a businessId (it belongs in the path, not the query)", () => {
    expect(
      reservationsByBusinessQuerySchema.safeParse({ businessId: VALID_ID })
        .success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      reservationsByBusinessQuerySchema.safeParse({ limit: 10 }).success,
    ).toBe(false);
  });
});

describe("reservationStatusValues", () => {
  it("matches the shared reservationStatusEnums (no drift)", () => {
    expect([...reservationStatusValues].sort()).toEqual(
      [...reservationStatusEnums].sort(),
    );
  });
});

describe("server-owned fields are excluded from every reservations DTO", () => {
  it.each(Object.entries(reservationDtoSchemas))(
    "%s has no server-owned key",
    (_name, schema) => {
      const keys = Object.keys(schema.shape);
      expect(keys).not.toContain("_id");
      expect(keys).not.toContain("createdAt");
      expect(keys).not.toContain("updatedAt");
      expect(keys).not.toContain("createdByUserId");
      expect(keys).not.toContain("createdByRole");
      expect(keys).not.toContain("salesInstanceId");
    },
  );
});

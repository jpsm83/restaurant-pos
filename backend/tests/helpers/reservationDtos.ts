import type { z } from "zod";

import {
  createReservationBodySchema,
  reservationIdParamsSchema,
  reservationsByBusinessParamsSchema,
  reservationsByBusinessQuerySchema,
  reservationsIncludeDeletedQuerySchema,
  reservationsQuerySchema,
  updateReservationBodySchema,
} from "restaurant-pos-packages/schemas/reservations";

/**
 * Every reservations DTO, keyed by name, for the shared server-owned-field
 * sweep in the schema and parity tests. Keep this the single list so adding a
 * DTO updates both suites at once.
 */
export const reservationDtoSchemas: Record<string, z.ZodObject> = {
  createReservationBodySchema,
  reservationIdParamsSchema,
  updateReservationBodySchema,
  reservationsQuerySchema,
  reservationsByBusinessParamsSchema,
  reservationsByBusinessQuerySchema,
  reservationsIncludeDeletedQuerySchema,
};

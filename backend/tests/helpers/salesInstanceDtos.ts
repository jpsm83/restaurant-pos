import type { z } from "zod";

import {
  createSalesInstanceBodySchema,
  salesInstanceIdParamsSchema,
  salesInstancesByBusinessParamsSchema,
  salesInstancesByUserParamsSchema,
  transferSalesPointBodySchema,
  updateSalesInstanceBodySchema,
} from "domain/schemas/salesInstances";

/**
 * Every core salesInstances DTO, keyed by name, for the shared server-owned
 * field sweep in the parity test. Keep this the single list so adding a DTO
 * updates the sweep at once.
 */
export const salesInstanceDtoSchemas: Record<string, z.ZodObject> = {
  createSalesInstanceBodySchema,
  salesInstanceIdParamsSchema,
  updateSalesInstanceBodySchema,
  transferSalesPointBodySchema,
  salesInstancesByBusinessParamsSchema,
  salesInstancesByUserParamsSchema,
};

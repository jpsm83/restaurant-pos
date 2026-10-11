/**
 * Printers DTOs — the request bodies and path params the printers routes accept.
 *
 * Backend-only (not shared with the frontend). Strict (unknown keys rejected)
 * and client-settable only: the server-owned `_id`, timestamps and computed
 * `printerStatus` never appear in a DTO, so a client that sends them gets a
 * `400`. `mainCategory` is pinned to the shared `mainCategoriesEnums` values and
 * every id field is an ObjectId (arrays included). Connectivity checks and the
 * duplicate alias/ip/employee rules span the database and stay in the route as
 * named post-parse checks, as do the non-empty array rules.
 */
import { z } from "zod";

import { mainCategoriesEnums } from "../../../packages/enums.ts";
import {
  coercedIntSchema,
  freeTextString,
  objectIdSchema,
  sanitizedString,
} from "../../../packages/schemas/primitives.ts";

/** A `mainCategory` from the shared enum. */
export const mainCategorySchema = z.enum(
  mainCategoriesEnums as [string, ...string[]],
  `mainCategory must be one of: ${mainCategoriesEnums.join(", ")}`,
);

/** An array of ObjectIds; non-emptiness is a post-parse check. */
const objectIdArraySchema = z.array(objectIdSchema);

/** A printer TCP port: a positive integer, coerced from a string form value. */
const portSchema = coercedIntSchema.positive("Port must be a positive integer");

/**
 * Body for `POST /printers`. `printerStatus` is server-computed from the
 * connectivity check and `configurationSetupToPrintOrders` is managed through
 * the dedicated configuration endpoints, so neither is client-settable here.
 */
export const createPrinterBodySchema = z.strictObject({
  printerAlias: sanitizedString("PrinterAlias is required!"),
  description: freeTextString().optional(),
  ipAddress: sanitizedString("IpAddress is required!"),
  port: portSchema,
  businessId: objectIdSchema,
  backupPrinterId: objectIdSchema.optional(),
  employeesAllowedToPrintDataIds: objectIdArraySchema.optional(),
});

/**
 * Body for `PATCH /printers/:printerId` — every create field is optional and
 * `businessId` is server-owned and not client-settable on update.
 */
export const updatePrinterBodySchema = z.strictObject({
  printerAlias: sanitizedString().optional(),
  description: freeTextString().optional(),
  ipAddress: sanitizedString().optional(),
  port: portSchema.optional(),
  backupPrinterId: objectIdSchema.optional(),
  employeesAllowedToPrintDataIds: objectIdArraySchema.optional(),
});

/** Path params for `GET`/`PATCH`/`DELETE /printers/:printerId`. */
export const printerIdParamsSchema = z.strictObject({
  printerId: objectIdSchema,
});

/** Path params for the configuration-setup routes. */
export const configurationSetupParamsSchema = z.strictObject({
  printerId: objectIdSchema,
  configId: objectIdSchema,
});

/**
 * Body for the configuration-setup add/edit routes. The non-empty array rules
 * are cross-field-ish and kept as named post-parse checks in the route.
 */
export const configurationSetupBodySchema = z.strictObject({
  mainCategory: mainCategorySchema,
  subCategories: z.array(sanitizedString()).optional(),
  salesPointIds: objectIdArraySchema,
  excludeEmployeeIds: objectIdArraySchema.optional(),
});

/** Path params for `GET /printers/business/:businessId`. */
export const printersByBusinessParamsSchema = z.strictObject({
  businessId: objectIdSchema,
});

export type MainCategory = z.infer<typeof mainCategorySchema>;
export type CreatePrinterBody = z.infer<typeof createPrinterBodySchema>;
export type UpdatePrinterBody = z.infer<typeof updatePrinterBodySchema>;
export type PrinterIdParams = z.infer<typeof printerIdParamsSchema>;
export type ConfigurationSetupParams = z.infer<
  typeof configurationSetupParamsSchema
>;
export type ConfigurationSetupBody = z.infer<
  typeof configurationSetupBodySchema
>;
export type PrintersByBusinessParams = z.infer<
  typeof printersByBusinessParamsSchema
>;

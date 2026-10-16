/**
 * SupplierGood DTOs — the request bodies and path params the supplierGoods
 * routes accept.
 *
 * Strict (unknown keys rejected) and client-settable only: the server-owned
 * `imagesUrl` and the computed `pricePerMeasurementUnit` never appear in a DTO,
 * so a client that sends them gets a `400`. On create the server owns
 * `currentlyInUse` (new goods start in use) and the owning `supplierId` and
 * `businessId` are required; on update the good is identified by its path param
 * and `currentlyInUse` is client-settable. The create and update bodies are
 * consumed through the shared multipart helper, so the JSON-encoded `allergens`
 * field is parsed and validated here. Enum values come from
 * `packages/enums.ts`. The database-dependent in-use delete guard stays as a
 * post-parse check in the route.
 */
import { z } from "zod";

import {
  allergensEnums,
  budgetImpactEnums,
  inventoryScheduleEnums,
  mainCategoriesEnums,
  measurementUnitEnums,
  purchaseUnitEnums,
} from "../enums.ts";
import {
  coercedBooleanSchema,
  coercedNumberSchema,
  emptyToUndefined,
  type EnumValues,
  freeTextString,
  jsonField,
  objectIdSchema,
  sanitizedString,
} from "./primitives.ts";

/** An optional JSON-encoded field; a blank string is treated as "not provided". */
const optionalJsonField = <T extends z.ZodType>(schema: T) =>
  z.preprocess(emptyToUndefined, jsonField(schema).optional());

/** A number from a form string; a blank string is "not provided". */
const optionalNumberSchema = z.preprocess(
  emptyToUndefined,
  coercedNumberSchema.optional(),
);

/** An optional enum field; a blank string is "not provided". */
const optionalEnum = <T extends z.ZodType>(schema: T) =>
  z.preprocess(emptyToUndefined, schema.optional());

const mainCategorySchema = z.enum(
  mainCategoriesEnums as EnumValues,
  "Invalid main category!",
);

const measurementUnitSchema = z.enum(
  measurementUnitEnums as EnumValues,
  "Invalid measurement unit!",
);

const purchaseUnitSchema = z.enum(
  purchaseUnitEnums as EnumValues,
  "Invalid purchase unit!",
);

const budgetImpactSchema = z.enum(
  budgetImpactEnums as EnumValues,
  "Invalid budget impact!",
);

const inventoryScheduleSchema = z.enum(
  inventoryScheduleEnums as EnumValues,
  "Invalid inventory schedule!",
);

const allergenSchema = z.enum(allergensEnums as EnumValues, "Invalid allergen!");

const supplierGoodFields = {
  name: sanitizedString("Name is required!"),
  keyword: sanitizedString("Keyword is required!"),
  mainCategory: mainCategorySchema,
  subCategory: z.preprocess(emptyToUndefined, sanitizedString().optional()),
  description: z.preprocess(emptyToUndefined, freeTextString().optional()),
  allergens: optionalJsonField(z.array(allergenSchema)),
  budgetImpact: optionalEnum(budgetImpactSchema),
  inventorySchedule: optionalEnum(inventoryScheduleSchema),
  minimumQuantityRequired: optionalNumberSchema,
  parLevel: optionalNumberSchema,
  purchaseUnit: optionalEnum(purchaseUnitSchema),
  measurementUnit: optionalEnum(measurementUnitSchema),
  quantityInMeasurementUnit: optionalNumberSchema,
  totalPurchasePrice: optionalNumberSchema,
};

/**
 * Body for `POST /supplierGoods` (multipart). Uploaded images are collected by
 * the multipart helper as files, not fields; `imagesUrl` and
 * `pricePerMeasurementUnit` are server-owned and rejected here. `currentlyInUse`
 * is set by the route on create and is not client-settable.
 */
export const createSupplierGoodBodySchema = z.strictObject({
  ...supplierGoodFields,
  supplierId: objectIdSchema,
  businessId: objectIdSchema,
});

/**
 * Body for `PATCH /supplierGoods/:supplierGoodId` (multipart). Same fields as
 * create, but the good is identified by its path param, `supplierId` and
 * `businessId` are not client-settable on update, and `currentlyInUse` is.
 */
export const updateSupplierGoodBodySchema = z.strictObject({
  ...supplierGoodFields,
  currentlyInUse: coercedBooleanSchema,
});

/** Path params for `GET`/`PATCH`/`DELETE /supplierGoods/:supplierGoodId`. */
export const supplierGoodIdParamsSchema = z.strictObject({
  supplierGoodId: objectIdSchema,
});

/** Path params for `GET /supplierGoods/supplier/:supplierId`. */
export const supplierGoodBySupplierParamsSchema = z.strictObject({
  supplierId: objectIdSchema,
});

export type CreateSupplierGoodBody = z.infer<
  typeof createSupplierGoodBodySchema
>;
export type UpdateSupplierGoodBody = z.infer<
  typeof updateSupplierGoodBodySchema
>;
export type SupplierGoodIdParams = z.infer<typeof supplierGoodIdParamsSchema>;
export type SupplierGoodBySupplierParams = z.infer<
  typeof supplierGoodBySupplierParamsSchema
>;

/**
 * BusinessGood DTOs — the request bodies and path params the businessGoods
 * routes accept.
 *
 * Strict (unknown keys rejected) and client-settable only: the server-owned
 * `costPrice`, `suggestedSellingPrice` and `imagesUrl` (and each ingredient's
 * computed `costOfRequiredQuantity`) never appear in a DTO, so a client that
 * sends them gets a `400`. The create and update bodies are consumed through
 * the shared multipart helper, so the JSON-encoded `ingredients`, `setMenuIds`
 * and `allergens` fields are parsed and validated here. Enum values come from
 * `packages/enums.ts`. The ingredients-XOR-setMenu rule is a named post-parse
 * check in the route, because it depends on more than one field.
 */
import { z } from "zod";

import {
  allergensEnums,
  mainCategoriesEnums,
  measurementUnitEnums,
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

const mainCategorySchema = z.enum(
  mainCategoriesEnums as EnumValues,
  "Invalid main category!",
);

const measurementUnitSchema = z.enum(
  measurementUnitEnums as EnumValues,
  "Invalid measurement unit!",
);

const allergenSchema = z.enum(allergensEnums as EnumValues, "Invalid allergen!");

/**
 * One ingredient line. `supplierGoodId` is an ObjectId and `requiredQuantity`
 * is coerced so a numeric form value is accepted. `costOfRequiredQuantity` is
 * computed by the route (from the supplier good's price) and is intentionally
 * rejected here.
 */
export const ingredientSchema = z.strictObject({
  supplierGoodId: objectIdSchema,
  measurementUnit: measurementUnitSchema,
  requiredQuantity: coercedNumberSchema,
});

const businessGoodFields = {
  name: sanitizedString("Name is required!"),
  keyword: sanitizedString("Keyword is required!"),
  mainCategory: mainCategorySchema,
  subCategory: z.preprocess(emptyToUndefined, sanitizedString().optional()),
  onMenu: coercedBooleanSchema,
  available: coercedBooleanSchema,
  sellingPrice: coercedNumberSchema.positive(
    "Selling price must be greater than 0!",
  ),
  ingredients: optionalJsonField(z.array(ingredientSchema)),
  setMenuIds: optionalJsonField(z.array(objectIdSchema)),
  grossProfitMarginDesired: optionalNumberSchema,
  description: z.preprocess(emptyToUndefined, freeTextString().optional()),
  allergens: optionalJsonField(z.array(allergenSchema)),
  deliveryTime: optionalNumberSchema,
};

/**
 * Body for `POST /businessGoods` (multipart). The uploaded images are collected
 * by the multipart helper as files, not fields.
 */
export const createBusinessGoodBodySchema = z.strictObject({
  ...businessGoodFields,
  businessId: objectIdSchema,
});

/**
 * Body for `PATCH /businessGoods/:businessGoodId` (multipart). Same fields as
 * create, but the good is identified by its path param and `businessId` is not
 * client-settable on update.
 */
export const updateBusinessGoodBodySchema = createBusinessGoodBodySchema.omit({
  businessId: true,
});

/** Path params for `GET`/`PATCH`/`DELETE /businessGoods/:businessGoodId`. */
export const businessGoodIdParamsSchema = z.strictObject({
  businessGoodId: objectIdSchema,
});

/** Path params for `GET /businessGoods/business/:businessId`. */
export const businessGoodByBusinessParamsSchema = z.strictObject({
  businessId: objectIdSchema,
});

/** Optional query for business-good reads: include soft-deleted records explicitly. */
export const businessGoodsIncludeDeletedQuerySchema = z.strictObject({
  includeDeleted: z.preprocess(emptyToUndefined, coercedBooleanSchema.optional()),
});

export type Ingredient = z.infer<typeof ingredientSchema>;
export type CreateBusinessGoodBody = z.infer<typeof createBusinessGoodBodySchema>;
export type UpdateBusinessGoodBody = z.infer<typeof updateBusinessGoodBodySchema>;
export type BusinessGoodIdParams = z.infer<typeof businessGoodIdParamsSchema>;
export type BusinessGoodByBusinessParams = z.infer<
  typeof businessGoodByBusinessParamsSchema
>;
export type BusinessGoodsIncludeDeletedQuery = z.infer<
  typeof businessGoodsIncludeDeletedQuerySchema
>;

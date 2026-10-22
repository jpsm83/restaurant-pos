/**
 * BusinessGoods Routes — business good CRUD and listing.
 *
 * Multipart bodies (create and update) are buffered and validated by the shared
 * multipart helper against strict zod DTOs from
 * `packages/schemas/businessGood.ts`; the JSON-encoded `ingredients`,
 * `setMenuIds` and `allergens` fields are parsed and validated there. The
 * GET/PATCH/DELETE path params are validated by their DTOs. The
 * ingredients-XOR-setMenu rule stays here as a named post-parse check, because
 * it depends on more than one field, as does the database-dependent
 * cost/allergen calculation. Every error is raised as an `AppError` so the
 * global handler emits RFC 9457 `application/problem+json`.
 */
import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type { IBusinessGood } from "restaurant-pos-packages/interfaces/IBusinessGood";

import BusinessGood from "../../models/businessGood.ts";
import SupplierGood from "../../models/supplierGood.ts";
import Promotion from "../../models/promotion.ts";
import Order from "../../models/order.ts";
import uploadFilesCloudinary from "../../cloudinary/uploadFilesCloudinary.ts";
import deleteFolderCloudinary from "../../cloudinary/deleteFolderCloudinary.ts";
import { markAsDeletedById, withSoftDeleteFilter } from "../../models/softDelete.ts";
import calculateIngredientsCostPriceAndAllergies from "../../businessGoods/calculateIngredientsCostPriceAndAllergies.ts";
import { calculateSetMenuCostPriceAndAllergies } from "../../businessGoods/calculateSetMenuCostPriceAndAllergies.ts";
import { badRequest, conflict, notFound } from "../../errors/appError.ts";
import { parseMultipart } from "../../schemas/multipart.ts";
import {
  businessGoodByBusinessParamsSchema,
  businessGoodIdParamsSchema,
  businessGoodsIncludeDeletedQuerySchema,
  createBusinessGoodBodySchema,
  updateBusinessGoodBodySchema,
  type BusinessGoodByBusinessParams,
  type BusinessGoodsIncludeDeletedQuery,
  type BusinessGoodIdParams,
  type Ingredient,
} from "restaurant-pos-packages/schemas/businessGood";

/** Files a good may hold in total; create and update enforce the same cap. */
const MAX_IMAGE_FILES = 3;

/**
 * The ingredients-XOR-setMenu rule: a good may carry ingredients or set-menu
 * references (or neither), never both. Post-parse because it spans two fields.
 */
function assertIngredientsXorSetMenu(fields: {
  ingredients?: unknown[];
  setMenuIds?: unknown[];
}): void {
  const hasIngredients = (fields.ingredients?.length ?? 0) > 0;
  const hasSetMenu = (fields.setMenuIds?.length ?? 0) > 0;
  if (hasIngredients && hasSetMenu) {
    throw badRequest("Only one of ingredients or setMenuIds can be assigned!");
  }
}

const BUSINESS_GOOD_POPULATE = [
  {
    path: "ingredients.supplierGoodId",
    select: "name mainCategory subCategory",
    model: SupplierGood,
  },
  {
    path: "setMenuIds",
    select: "name mainCategory subCategory sellingPrice",
    model: BusinessGood,
  },
];

/** Map parsed ingredients to the ids the cost/allergen calculator expects. */
function toCalculatorIngredients(ingredients: Ingredient[]) {
  return ingredients.map((ingredient) => ({
    ...ingredient,
    supplierGoodId: new Types.ObjectId(ingredient.supplierGoodId),
  }));
}

/**
 * Apply the ingredient-derived cost price and allergens to an update object.
 * `clearSetMenu` is `true` on update (an empty array un-sets the field) and
 * `false` on create (the field is simply absent).
 */
function applyIngredientCalculations(
  target: Partial<IBusinessGood>,
  calculated: Awaited<
    ReturnType<typeof calculateIngredientsCostPriceAndAllergies>
  >,
  selectedAllergens: string[],
  clearSetMenu: boolean,
): void {
  if (typeof calculated !== "object") {
    throw badRequest(calculated);
  }

  target.ingredients = calculated.map((ingredient) => ({
    supplierGoodId: ingredient.supplierGoodId,
    measurementUnit: ingredient.measurementUnit,
    requiredQuantity: ingredient.requiredQuantity ?? 0,
    costOfRequiredQuantity: ingredient.costOfRequiredQuantity,
  }));
  target.setMenuIds = clearSetMenu ? [] : undefined;

  target.costPrice = parseFloat(
    calculated
      .reduce(
        (acc, curr) => acc + (curr.costOfRequiredQuantity ?? 0),
        0,
      )
      .toFixed(2),
  );

  const reducedAllergens = calculated.reduce((acc: string[], curr) => {
    curr.allergens?.forEach((allergen) => {
      if (!acc.includes(allergen)) {
        acc.push(allergen);
      }
    });
    return acc;
  }, []);

  const allergensArr = [...selectedAllergens];
  allergensArr.push(
    ...reducedAllergens.filter((allergen) => !allergensArr.includes(allergen)),
  );

  target.allergens = allergensArr.length > 0 ? allergensArr : undefined;
}

/** Apply the set-menu-derived cost price and allergens to an update object. */
function applySetMenuCalculations(
  target: Partial<IBusinessGood>,
  calculated: Awaited<
    ReturnType<typeof calculateSetMenuCostPriceAndAllergies>
  >,
  setMenuIds: string[],
  clearIngredients: boolean,
): void {
  if (typeof calculated !== "object") {
    throw badRequest(calculated);
  }

  target.ingredients = clearIngredients ? [] : undefined;
  target.setMenuIds = setMenuIds.map((id) => new Types.ObjectId(id));
  target.costPrice = parseFloat(calculated.costPrice.toFixed(2));
  target.allergens =
    calculated.allergens && calculated.allergens.length > 0
      ? calculated.allergens
      : undefined;
}

/** Suggested selling price from the cost price and the desired margin. */
function applySuggestedSellingPrice(
  target: Partial<IBusinessGood>,
  grossProfitMarginDesired: number | undefined,
): void {
  if (target.costPrice && grossProfitMarginDesired) {
    target.suggestedSellingPrice = parseFloat(
      (target.costPrice * (1 + grossProfitMarginDesired / 100)).toFixed(2),
    );
  }
}

export const businessGoodsRoutes: FastifyPluginAsync = async (app) => {
  // GET /businessGoods - list all business goods
  app.get<{ Querystring: BusinessGoodsIncludeDeletedQuery }>(
    "/",
    { schema: { querystring: businessGoodsIncludeDeletedQuerySchema } },
    async (req, reply) => {
      const { includeDeleted = false } = req.query;
      const businessGoods = await BusinessGood.find(
        withSoftDeleteFilter({}, includeDeleted),
      )
      .populate(BUSINESS_GOOD_POPULATE)
      .lean();

      if (!businessGoods.length) {
        throw notFound("No businessId goods found!");
      }
      return reply.code(200).send(businessGoods);
    },
  );

  // POST /businessGoods - create business good (formData with image)
  app.post("/", async (req, reply) => {
    const { fields, files } = await parseMultipart(
      req,
      createBusinessGoodBodySchema,
    );

    if (files.length > MAX_IMAGE_FILES) {
      throw badRequest(`Max file quantity is ${MAX_IMAGE_FILES}!`);
    }

    assertIngredientsXorSetMenu(fields);

    const duplicateBusinessGood = await BusinessGood.exists(
      withSoftDeleteFilter({
        businessId: fields.businessId,
        name: fields.name,
      }),
    );

    if (duplicateBusinessGood) {
      throw badRequest(`${fields.name} already exists on businessId goods!`);
    }

    const businessGoodId = new mongoose.Types.ObjectId();

    const newBusinessGood: Partial<IBusinessGood> = {
      _id: businessGoodId,
      name: fields.name,
      keyword: fields.keyword,
      mainCategory: fields.mainCategory,
      onMenu: fields.onMenu,
      available: fields.available,
      sellingPrice: fields.sellingPrice,
      businessId: new Types.ObjectId(fields.businessId),
      subCategory: fields.subCategory,
      setMenuIds:
        fields.setMenuIds && fields.setMenuIds.length > 0
          ? fields.setMenuIds.map((id) => new Types.ObjectId(id))
          : undefined,
      grossProfitMarginDesired: fields.grossProfitMarginDesired,
      description: fields.description,
      deliveryTime: fields.deliveryTime,
    };

    if (files.length > 0) {
      const folder = `/business/${fields.businessId}/businessGoods/${businessGoodId}`;

      const cloudinaryUploadResponse = await uploadFilesCloudinary({
        folder,
        filesArr: files.map((file) => ({
          buffer: file.buffer,
          mimeType: file.mimetype,
        })),
        onlyImages: true,
      });

      if (
        typeof cloudinaryUploadResponse === "string" ||
        cloudinaryUploadResponse.length === 0 ||
        !cloudinaryUploadResponse.every((str) => str.includes("https://"))
      ) {
        throw badRequest(`Error uploading image: ${cloudinaryUploadResponse}`);
      }

      newBusinessGood.imagesUrl = cloudinaryUploadResponse;
    }

    if (fields.ingredients && fields.ingredients.length > 0) {
      const calculated = await calculateIngredientsCostPriceAndAllergies(
        toCalculatorIngredients(fields.ingredients),
      );
      applyIngredientCalculations(
        newBusinessGood,
        calculated,
        fields.allergens ?? [],
        false,
      );
    }

    if (fields.setMenuIds && fields.setMenuIds.length > 0) {
      const calculated = await calculateSetMenuCostPriceAndAllergies(
        fields.setMenuIds,
      );
      applySetMenuCalculations(
        newBusinessGood,
        calculated,
        fields.setMenuIds,
        false,
      );
    }

    applySuggestedSellingPrice(
      newBusinessGood,
      fields.grossProfitMarginDesired,
    );

    await BusinessGood.create(newBusinessGood);

    return reply.code(201).send({
      message: `BusinessId good created successfully!`,
    });
  });

  // GET /businessGoods/:businessGoodId - get by ID
  app.get<{
    Params: BusinessGoodIdParams;
    Querystring: BusinessGoodsIncludeDeletedQuery;
  }>(
    "/:businessGoodId",
    {
      schema: {
        params: businessGoodIdParamsSchema,
        querystring: businessGoodsIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { businessGoodId } = req.params;
      const { includeDeleted = false } = req.query;

      const businessGood = await BusinessGood.findOne(
        withSoftDeleteFilter({ _id: businessGoodId }, includeDeleted),
      )
        .populate(BUSINESS_GOOD_POPULATE)
        .lean();

      if (!businessGood) {
        throw notFound("No business good found!");
      }
      return reply.code(200).send(businessGood);
    },
  );

  // PATCH /businessGoods/:businessGoodId - update (formData with image)
  app.patch<{ Params: BusinessGoodIdParams }>(
    "/:businessGoodId",
    { schema: { params: businessGoodIdParamsSchema } },
    async (req, reply) => {
      const { businessGoodId } = req.params;

      const { fields, files } = await parseMultipart(
        req,
        updateBusinessGoodBodySchema,
      );

      assertIngredientsXorSetMenu(fields);

      const businessGood = (await BusinessGood.findOne(
        withSoftDeleteFilter({ _id: businessGoodId }),
      ).lean()) as IBusinessGood | null;

      if (!businessGood) {
        throw notFound("Business good not found!");
      }

      if (
        files.length + (businessGood.imagesUrl?.length ?? 0) >
        MAX_IMAGE_FILES
      ) {
        throw badRequest(`Max file quantity is ${MAX_IMAGE_FILES}!`);
      }

      const duplicateBusinessGood = await BusinessGood.exists({
        ...withSoftDeleteFilter({
          _id: { $ne: businessGoodId },
          businessId: businessGood.businessId,
          name: fields.name,
        }),
      });

      if (duplicateBusinessGood) {
        throw conflict(`Business good ${fields.name} already exists!`);
      }

      const updatedBusinessGoodObj: Partial<IBusinessGood> = {};

      if (fields.name !== businessGood.name)
        updatedBusinessGoodObj.name = fields.name;
      if (fields.keyword !== businessGood.keyword)
        updatedBusinessGoodObj.keyword = fields.keyword;
      if (fields.mainCategory !== businessGood.mainCategory)
        updatedBusinessGoodObj.mainCategory = fields.mainCategory;
      if (fields.onMenu !== businessGood.onMenu)
        updatedBusinessGoodObj.onMenu = fields.onMenu;
      if (fields.available !== businessGood.available)
        updatedBusinessGoodObj.available = fields.available;
      if (fields.sellingPrice !== businessGood.sellingPrice)
        updatedBusinessGoodObj.sellingPrice = fields.sellingPrice;

      if (
        fields.subCategory !== undefined &&
        fields.subCategory !== businessGood.subCategory
      )
        updatedBusinessGoodObj.subCategory = fields.subCategory;
      if (
        fields.grossProfitMarginDesired !== undefined &&
        fields.grossProfitMarginDesired !==
          businessGood.grossProfitMarginDesired
      )
        updatedBusinessGoodObj.grossProfitMarginDesired =
          fields.grossProfitMarginDesired;
      if (
        fields.description !== undefined &&
        fields.description !== businessGood.description
      )
        updatedBusinessGoodObj.description = fields.description;
      if (fields.allergens !== undefined)
        updatedBusinessGoodObj.allergens = fields.allergens;
      if (
        fields.deliveryTime !== undefined &&
        fields.deliveryTime !== businessGood.deliveryTime
      )
        updatedBusinessGoodObj.deliveryTime = fields.deliveryTime;

      if (files.length > 0) {
        const folder = `/business/${businessGood.businessId}/businessGoods/${businessGoodId}`;

        const cloudinaryUploadResponse = await uploadFilesCloudinary({
          folder,
          filesArr: files.map((file) => ({
            buffer: file.buffer,
            mimeType: file.mimetype,
          })),
          onlyImages: true,
        });

        if (
          typeof cloudinaryUploadResponse === "string" ||
          cloudinaryUploadResponse.length === 0 ||
          !cloudinaryUploadResponse.every((str) => str.includes("https://"))
        ) {
          throw badRequest(`Error uploading image: ${cloudinaryUploadResponse}`);
        }

        updatedBusinessGoodObj.imagesUrl = [
          ...(businessGood.imagesUrl ?? []),
          ...cloudinaryUploadResponse,
        ];
      }

      if (fields.ingredients && fields.ingredients.length > 0) {
        const calculated = await calculateIngredientsCostPriceAndAllergies(
          toCalculatorIngredients(fields.ingredients),
        );
        applyIngredientCalculations(
          updatedBusinessGoodObj,
          calculated,
          fields.allergens ?? [],
          true,
        );
      }

      if (fields.setMenuIds && fields.setMenuIds.length > 0) {
        const calculated = await calculateSetMenuCostPriceAndAllergies(
          fields.setMenuIds,
        );
        applySetMenuCalculations(
          updatedBusinessGoodObj,
          calculated,
          fields.setMenuIds,
          true,
        );
      }

      applySuggestedSellingPrice(
        updatedBusinessGoodObj,
        fields.grossProfitMarginDesired,
      );

      const updateBusinessGood = await BusinessGood.findOneAndUpdate(
        withSoftDeleteFilter({ _id: businessGoodId }),
        { $set: updatedBusinessGoodObj },
        { returnDocument: "after", lean: true },
      );

      if (!updateBusinessGood) {
        throw notFound("Business good to update not found!");
      }

      return reply.code(200).send({
        message: `Business good updated successfully!`,
      });
    },
  );

  // DELETE /businessGoods/:businessGoodId - delete with transaction
  app.delete<{ Params: BusinessGoodIdParams }>(
    "/:businessGoodId",
    { schema: { params: businessGoodIdParamsSchema } },
    async (req, reply) => {
      const { businessGoodId } = req.params;

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const businessGood = (await BusinessGood.findById(businessGoodId)
          .select("businessId deleted")
          .session(session)
          .lean()) as IBusinessGood | null;
        if (!businessGood) {
          throw notFound("Business good not found!");
        }
        if (businessGood.deleted) {
          throw conflict("Business good already deleted!");
        }

        const businessGoodInOrders = await Order.exists({
          $or: [
            { businessGoodId, billingStatus: "Open" },
            { addOns: businessGoodId, billingStatus: "Open" },
          ],
        }).session(session);
        const businessGoodInSetMenu = await BusinessGood.exists({
          setMenuIds: businessGoodId,
        }).session(session);

        if (businessGoodInOrders || businessGoodInSetMenu) {
          throw badRequest(
            businessGoodInOrders
              ? "Cannot delete Business good because it is in some open orders!"
              : "Cannot delete Business good because it is in some set menu!",
          );
        }

        const wasDeleted = await markAsDeletedById(
          BusinessGood as mongoose.Model<IBusinessGood & { deleted: boolean }>,
          businessGoodId,
        );
        if (!wasDeleted) {
          throw conflict("Business good already deleted!");
        }
        await Promotion.updateMany(
          { businessGoodsToApplyIds: businessGoodId },
          { $pull: { businessGoodsToApplyIds: businessGoodId } },
          { session },
        );
        const folderPath = `/business/${businessGood.businessId}/businessGoods/${businessGoodId}`;

        const deleteFolderCloudinaryResult =
          await deleteFolderCloudinary(folderPath);

        if (deleteFolderCloudinaryResult !== true) {
          throw badRequest(
            typeof deleteFolderCloudinaryResult === "string"
              ? deleteFolderCloudinaryResult
              : "DeleteCloudinaryFolder failed!",
          );
        }

        await session.commitTransaction();

        return reply.code(200).send({
          message: `Business good ${businessGoodId} deleted successfully!`,
        });
      } catch (error) {
        await session.abortTransaction().catch(() => undefined);
        throw error;
      } finally {
        session.endSession();
      }
    },
  );

  // GET /businessGoods/business/:businessId - get by business
  app.get<{
    Params: BusinessGoodByBusinessParams;
    Querystring: BusinessGoodsIncludeDeletedQuery;
  }>(
    "/business/:businessId",
    {
      schema: {
        params: businessGoodByBusinessParamsSchema,
        querystring: businessGoodsIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { businessId } = req.params;
      const { includeDeleted = false } = req.query;

      const businessGoods = await BusinessGood.find(
        withSoftDeleteFilter({ businessId }, includeDeleted),
      )
        .populate(BUSINESS_GOOD_POPULATE)
        .lean();

      if (!businessGoods.length) {
        throw notFound("No business goods found!");
      }
      return reply.code(200).send(businessGoods);
    },
  );
};

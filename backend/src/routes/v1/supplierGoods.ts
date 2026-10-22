/**
 * SupplierGoods Routes — supplier good CRUD, per-supplier listing and inventory
 * synchronisation.
 *
 * Multipart bodies (create and update) are buffered and validated by the shared
 * multipart helper against strict zod DTOs from
 * `packages/schemas/supplierGood.ts`; the JSON-encoded `allergens` field is
 * parsed and validated there. The GET/PATCH/DELETE path params are validated by
 * their DTOs. The database-dependent in-use delete guard stays here as a named
 * post-parse check. Every error is raised as an `AppError` so the global handler
 * emits RFC 9457 `application/problem+json`.
 */
import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type { ISupplierGood } from "restaurant-pos-packages/interfaces/ISupplierGood";

import SupplierGood from "../../models/supplierGood.ts";
import Supplier from "../../models/supplier.ts";
import BusinessGood from "../../models/businessGood.ts";
import Inventory from "../../models/inventory.ts";
import deleteFolderCloudinary from "../../cloudinary/deleteFolderCloudinary.ts";
import addSupplierGoodToInventory from "../../inventories/addSupplierGoodToInventory.ts";
import deleteSupplierGoodFromInventory from "../../inventories/deleteSupplierGoodFromInventory.ts";
import uploadFilesCloudinary from "../../cloudinary/uploadFilesCloudinary.ts";
import { markAsDeletedById, withSoftDeleteFilter } from "../../models/softDelete.ts";
import { badRequest, conflict, notFound } from "../../errors/appError.ts";
import { parseMultipart } from "../../schemas/multipart.ts";
import {
  createSupplierGoodBodySchema,
  supplierGoodBySupplierParamsSchema,
  supplierGoodsIncludeDeletedQuerySchema,
  supplierGoodIdParamsSchema,
  updateSupplierGoodBodySchema,
  type CreateSupplierGoodBody,
  type SupplierGoodBySupplierParams,
  type SupplierGoodsIncludeDeletedQuery,
  type SupplierGoodIdParams,
} from "restaurant-pos-packages/schemas/supplierGood";

/** Files a supplier good may hold in total; create and update enforce the cap. */
const MAX_IMAGE_FILES = 3;

const SUPPLIER_POPULATE = {
  path: "supplierId",
  select: "tradeName",
  model: Supplier,
};

/** Upload collected files to Cloudinary, raising a `400` on any failure. */
async function uploadImages(
  folder: string,
  files: { buffer: Buffer; mimetype: string }[],
): Promise<string[]> {
  const response = await uploadFilesCloudinary({
    folder,
    filesArr: files.map((file) => ({
      buffer: file.buffer,
      mimeType: file.mimetype,
    })),
    onlyImages: true,
  });

  if (
    typeof response === "string" ||
    response.length === 0 ||
    !response.every((str) => str.includes("https://"))
  ) {
    throw badRequest(`Error uploading image: ${response}`);
  }

  return response;
}

/** The fields a create request contributes to the stored supplier good. */
function toNewSupplierGood(
  supplierGoodId: Types.ObjectId,
  fields: CreateSupplierGoodBody,
): Partial<ISupplierGood> {
  return {
    _id: supplierGoodId,
    name: fields.name,
    keyword: fields.keyword,
    mainCategory: fields.mainCategory,
    currentlyInUse: true,
    supplierId: new Types.ObjectId(fields.supplierId),
    businessId: new Types.ObjectId(fields.businessId),
    subCategory: fields.subCategory,
    description: fields.description,
    allergens:
      fields.allergens && fields.allergens.length > 0
        ? fields.allergens
        : undefined,
    budgetImpact: fields.budgetImpact,
    inventorySchedule: fields.inventorySchedule,
    minimumQuantityRequired: fields.minimumQuantityRequired || undefined,
    parLevel: fields.parLevel || undefined,
    purchaseUnit: fields.purchaseUnit,
    measurementUnit: fields.measurementUnit,
    quantityInMeasurementUnit: fields.quantityInMeasurementUnit || undefined,
    totalPurchasePrice: fields.totalPurchasePrice || undefined,
    pricePerMeasurementUnit:
      fields.totalPurchasePrice && fields.quantityInMeasurementUnit
        ? fields.totalPurchasePrice / fields.quantityInMeasurementUnit
        : undefined,
  };
}

export const supplierGoodsRoutes: FastifyPluginAsync = async (app) => {
  // GET /supplierGoods - list all
  app.get<{ Querystring: SupplierGoodsIncludeDeletedQuery }>(
    "/",
    { schema: { querystring: supplierGoodsIncludeDeletedQuerySchema } },
    async (req, reply) => {
      const { includeDeleted = false } = req.query;
      const supplierGoods = await SupplierGood.find(
        withSoftDeleteFilter({}, includeDeleted),
      )
      .populate(SUPPLIER_POPULATE)
      .lean();

      if (!supplierGoods.length) {
        throw notFound("No supplier goods found!");
      }
      return reply.code(200).send(supplierGoods);
    },
  );

  // POST /supplierGoods - create (formData with images, transaction)
  app.post("/", async (req, reply) => {
    const { fields, files } = await parseMultipart(
      req,
      createSupplierGoodBodySchema,
    );

    if (files.length > MAX_IMAGE_FILES) {
      throw badRequest(`Max file quantity is ${MAX_IMAGE_FILES}!`);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const duplicateSupplierGood = await SupplierGood.exists(
        withSoftDeleteFilter({
          businessId: fields.businessId,
          supplierId: fields.supplierId,
          name: fields.name,
        }),
      ).session(session);

      if (duplicateSupplierGood) {
        throw badRequest(`${fields.name} already exists on supplier goods!`);
      }

      const supplierGoodId = new mongoose.Types.ObjectId();
      const newSupplierGood = toNewSupplierGood(supplierGoodId, fields);

      if (files.length > 0) {
        const folder = `/business/${fields.businessId}/suppliersGoods/${supplierGoodId}`;
        newSupplierGood.imagesUrl = await uploadImages(folder, files);
      }

      const [createdSupplierGood] = await SupplierGood.create(
        [newSupplierGood],
        { session },
      );

      if (!createdSupplierGood) {
        throw badRequest("Supplier good creation failed!");
      }

      const addToInventoryResult = await addSupplierGoodToInventory(
        supplierGoodId,
        fields.businessId,
        session,
      );

      if (addToInventoryResult !== true) {
        throw badRequest(
          "Add supplier good to inventory failed! Error: " +
            addToInventoryResult,
        );
      }

      await session.commitTransaction();

      return reply.code(201).send({
        message: `Supplier good created successfully!`,
      });
    } catch (error) {
      await session.abortTransaction().catch(() => undefined);
      throw error;
    } finally {
      session.endSession();
    }
  });

  // GET /supplierGoods/:supplierGoodId - get by ID
  app.get<{
    Params: SupplierGoodIdParams;
    Querystring: SupplierGoodsIncludeDeletedQuery;
  }>(
    "/:supplierGoodId",
    {
      schema: {
        params: supplierGoodIdParamsSchema,
        querystring: supplierGoodsIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { supplierGoodId } = req.params;
      const { includeDeleted = false } = req.query;

      const supplierGood = await SupplierGood.findOne(
        withSoftDeleteFilter({ _id: supplierGoodId }, includeDeleted),
      )
        .populate(SUPPLIER_POPULATE)
        .lean();

      if (!supplierGood) {
        throw notFound("Supplier good not found!");
      }
      return reply.code(200).send(supplierGood);
    },
  );

  // PATCH /supplierGoods/:supplierGoodId - update (formData with images, transaction)
  app.patch<{ Params: SupplierGoodIdParams }>(
    "/:supplierGoodId",
    { schema: { params: supplierGoodIdParamsSchema } },
    async (req, reply) => {
      const { supplierGoodId } = req.params;

      const { fields, files } = await parseMultipart(
        req,
        updateSupplierGoodBodySchema,
      );

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const supplierGood = (await SupplierGood.findOne(
          withSoftDeleteFilter({ _id: supplierGoodId }),
        )
          .session(session)
          .lean()) as unknown as ISupplierGood | null;

        if (!supplierGood) {
          throw notFound("Supplier good not found!");
        }

        if (
          files.length + (supplierGood.imagesUrl?.length ?? 0) >
          MAX_IMAGE_FILES
        ) {
          throw badRequest(`Max file quantity is ${MAX_IMAGE_FILES}!`);
        }

        const duplicateSupplierGood = await SupplierGood.exists({
          ...withSoftDeleteFilter({
            _id: { $ne: supplierGoodId },
            businessId: supplierGood.businessId,
            supplierId: supplierGood.supplierId,
            name: fields.name,
          }),
        }).session(session);

        if (duplicateSupplierGood) {
          throw conflict(
            `Supplier good ${fields.name} already exists on this supplier!`,
          );
        }

        const updateSupplierGood: Partial<ISupplierGood> = {};

        if (fields.name !== supplierGood.name)
          updateSupplierGood.name = fields.name;
        if (fields.keyword !== supplierGood.keyword)
          updateSupplierGood.keyword = fields.keyword;
        if (fields.mainCategory !== supplierGood.mainCategory)
          updateSupplierGood.mainCategory = fields.mainCategory;
        if (fields.currentlyInUse !== supplierGood.currentlyInUse)
          updateSupplierGood.currentlyInUse = fields.currentlyInUse;

        if (
          fields.subCategory !== undefined &&
          fields.subCategory !== supplierGood.subCategory
        )
          updateSupplierGood.subCategory = fields.subCategory;
        if (
          fields.description !== undefined &&
          fields.description !== supplierGood.description
        )
          updateSupplierGood.description = fields.description;
        if (fields.allergens !== undefined)
          updateSupplierGood.allergens = fields.allergens;
        if (
          fields.budgetImpact !== undefined &&
          fields.budgetImpact !== supplierGood.budgetImpact
        )
          updateSupplierGood.budgetImpact = fields.budgetImpact;
        if (
          fields.inventorySchedule !== undefined &&
          fields.inventorySchedule !== supplierGood.inventorySchedule
        )
          updateSupplierGood.inventorySchedule = fields.inventorySchedule;
        if (
          fields.minimumQuantityRequired !== undefined &&
          fields.minimumQuantityRequired !== supplierGood.minimumQuantityRequired
        )
          updateSupplierGood.minimumQuantityRequired =
            fields.minimumQuantityRequired;
        if (
          fields.parLevel !== undefined &&
          fields.parLevel !== supplierGood.parLevel
        )
          updateSupplierGood.parLevel = fields.parLevel;
        if (
          fields.purchaseUnit !== undefined &&
          fields.purchaseUnit !== supplierGood.purchaseUnit
        )
          updateSupplierGood.purchaseUnit = fields.purchaseUnit;
        if (
          fields.measurementUnit !== undefined &&
          fields.measurementUnit !== supplierGood.measurementUnit
        )
          updateSupplierGood.measurementUnit = fields.measurementUnit;
        if (
          fields.quantityInMeasurementUnit !== undefined &&
          fields.quantityInMeasurementUnit !==
            supplierGood.quantityInMeasurementUnit
        )
          updateSupplierGood.quantityInMeasurementUnit =
            fields.quantityInMeasurementUnit;
        if (
          fields.totalPurchasePrice !== undefined &&
          fields.totalPurchasePrice !== supplierGood.totalPurchasePrice
        )
          updateSupplierGood.totalPurchasePrice = fields.totalPurchasePrice;

        if (
          updateSupplierGood.totalPurchasePrice &&
          updateSupplierGood.quantityInMeasurementUnit
        )
          updateSupplierGood.pricePerMeasurementUnit =
            updateSupplierGood.totalPurchasePrice /
            (updateSupplierGood.quantityInMeasurementUnit || 1);

        if (files.length > 0) {
          const folder = `/business/${supplierGood.businessId}/suppliersGoods/${supplierGoodId}`;

          updateSupplierGood.imagesUrl = [
            ...(supplierGood.imagesUrl ?? []),
            ...(await uploadImages(folder, files)),
          ];
        }

        const updatedSupplierGood = await SupplierGood.findOneAndUpdate(
          withSoftDeleteFilter({ _id: supplierGoodId }),
          { $set: updateSupplierGood },
          { returnDocument: "after", lean: true, session },
        );

        if (!updatedSupplierGood) {
          throw notFound("Supplier good not updated!");
        }

        const startOfCurrentMonth = new Date();
        startOfCurrentMonth.setDate(1);
        startOfCurrentMonth.setHours(0, 0, 0, 0);

        const endOfCurrentMonth = new Date(startOfCurrentMonth);
        endOfCurrentMonth.setMonth(endOfCurrentMonth.getMonth() + 1);
        endOfCurrentMonth.setMilliseconds(-1);

        const isSupplierGoodInInventory = await Inventory.exists({
          businessId: supplierGood.businessId,
          setFinalCount: false,
          createdAt: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth },
          "inventoryGoods.supplierGoodId": supplierGoodId,
        }).session(session);

        if (fields.currentlyInUse === true && !isSupplierGoodInInventory) {
          const addToInventoryResult = await addSupplierGoodToInventory(
            supplierGoodId,
            supplierGood.businessId as Types.ObjectId,
            session,
          );

          if (addToInventoryResult !== true) {
            throw badRequest(
              "Supplier good updated but fail to add to inventory! Error: " +
                addToInventoryResult,
            );
          }
        }

        await session.commitTransaction();

        return reply.code(200).send({
          message: "Supplier good updated successfully!",
        });
      } catch (error) {
        await session.abortTransaction().catch(() => undefined);
        throw error;
      } finally {
        session.endSession();
      }
    },
  );

  // DELETE /supplierGoods/:supplierGoodId - delete (transaction)
  app.delete<{ Params: SupplierGoodIdParams }>(
    "/:supplierGoodId",
    { schema: { params: supplierGoodIdParamsSchema } },
    async (req, reply) => {
      const { supplierGoodId } = req.params;

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const supplierGood = (await SupplierGood.findById(supplierGoodId)
          .setOptions({ includeDeleted: true })
          .select("businessId deleted")
          .session(session)
          .lean()) as unknown as ISupplierGood | null;

        if (!supplierGood) {
          throw notFound("Supplier good not found!");
        }
        if (supplierGood.deleted) {
          throw conflict("Supplier good already deleted!");
        }

        const isInUse = await BusinessGood.exists(
          withSoftDeleteFilter({
            businessId: supplierGood.businessId,
            "ingredients.supplierGoodId": supplierGoodId,
          }),
        ).session(session);

        if (isInUse) {
          throw conflict("Supplier good is in use in some business goods!");
        }

        const wasDeleted = await markAsDeletedById(
          SupplierGood as mongoose.Model<ISupplierGood & { deleted: boolean }>,
          supplierGoodId,
          session,
        );
        if (!wasDeleted) {
          throw conflict("Supplier good already deleted!");
        }

        const deleteFromInventoryResult = await deleteSupplierGoodFromInventory(
          supplierGoodId,
          supplierGood.businessId,
          session,
        );

        if (deleteFromInventoryResult !== true) {
          throw badRequest(deleteFromInventoryResult);
        }

        const folderPath = `/business/${supplierGood.businessId}/suppliersGoods/${supplierGoodId}`;

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
          message: `Supplier good deleted successfully!`,
        });
      } catch (error) {
        await session.abortTransaction().catch(() => undefined);
        throw error;
      } finally {
        session.endSession();
      }
    },
  );

  // GET /supplierGoods/supplier/:supplierId - get by supplier
  app.get<{
    Params: SupplierGoodBySupplierParams;
    Querystring: SupplierGoodsIncludeDeletedQuery;
  }>(
    "/supplier/:supplierId",
    {
      schema: {
        params: supplierGoodBySupplierParamsSchema,
        querystring: supplierGoodsIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { supplierId } = req.params;
      const { includeDeleted = false } = req.query;

      const supplierGoods = await SupplierGood.find(
        withSoftDeleteFilter({ supplierId }, includeDeleted),
      ).lean();

      if (!supplierGoods.length) {
        throw notFound("No supplier goods found!");
      }
      return reply.code(200).send(supplierGoods);
    },
  );
};

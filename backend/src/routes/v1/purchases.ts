/**
 * Purchases Routes — purchase CRUD, purchase-line edits and per-supplier /
 * per-user listings.
 *
 * Bodies, path params and query are validated by strict zod DTOs from
 * `packages/schemas/purchase.ts`: the create body and the JSON item bodies
 * (`addSupplierGood`, `deleteSupplierGood`, `editSupplierGood`) through their
 * route schemas, and the PATCH through the shared multipart helper when it
 * carries documents (otherwise its JSON body is validated against the same
 * DTO). Cross-field and database-dependent rules stay here as named
 * post-parse checks: the one-time-purchase comment rule, the
 * `startDate <= endDate` range rule, `validateInventoryPurchaseItems`, the
 * duplicate-receipt guard and the management-role guard. Every error is raised
 * as an `AppError` so the global handler emits RFC 9457
 * `application/problem+json`.
 */
import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type {
  IPurchase,
  IPurchaseItem,
} from "restaurant-pos-packages/interfaces/IPurchase";
import type { IEmployee } from "restaurant-pos-packages/interfaces/IEmployee";

import validateInventoryPurchaseItems from "../../purchases/validateInventoryPurchaseItems.ts";
import oneTimePurchaseSupplier from "../../suppliers/oneTimePurchaseSupplier.ts";
import Purchase from "../../models/purchase.ts";
import Inventory from "../../models/inventory.ts";
import Supplier from "../../models/supplier.ts";
import SupplierGood from "../../models/supplierGood.ts";
import Employee from "../../models/employee.ts";
import { createOptionalAuthHook } from "../../auth/middleware.ts";
import uploadFilesCloudinary from "../../cloudinary/uploadFilesCloudinary.ts";
import deleteFilesCloudinary from "../../cloudinary/deleteFilesCloudinary.ts";
import * as enums from "restaurant-pos-packages/enums";
import { runTxnWithTransientRetry } from "../../mongo/runTxnWithTransientRetry.ts";
import {
  badRequest,
  forbidden,
  internal,
  notFound,
  unauthorized,
} from "../../errors/appError.ts";
import {
  parseMultipart,
  validateFields,
  type MultipartFile,
} from "../../schemas/multipart.ts";
import {
  ONE_TIME_PURCHASE_SUPPLIER,
  addPurchaseItemBodySchema,
  createPurchaseBodySchema,
  deletePurchaseItemBodySchema,
  editPurchaseItemBodySchema,
  purchaseBySupplierParamsSchema,
  purchaseByUserParamsSchema,
  purchaseIdParamsSchema,
  purchasesQuerySchema,
  updatePurchaseBodySchema,
  type AddPurchaseItemBody,
  type CreatePurchaseBody,
  type DeletePurchaseItemBody,
  type EditPurchaseItemBody,
  type PurchaseBySupplierParams,
  type PurchaseByUserParams,
  type PurchaseIdParams,
  type PurchasesQuery,
  type UpdatePurchaseBody,
} from "restaurant-pos-packages/schemas/purchase";
import { objectIdSchema } from "restaurant-pos-packages/schemas/primitives";

const { managementRolesEnums } = enums;

const SUPPLIER_POPULATE = {
  path: "supplierId",
  select: "tradeName",
  model: Supplier,
};

const PURCHASE_ITEMS_POPULATE = {
  path: "purchaseInventoryItems.supplierGoodId",
  select: "name mainCategory subCategory measurementUnit pricePerMeasurementUnit",
  model: SupplierGood,
};

/** The `purchaseDate` range filter shared by the list routes. */
function purchaseDateFilter(
  startDate?: string,
  endDate?: string,
): { $gte: Date; $lte: Date } | undefined {
  if (!startDate || !endDate) return undefined;
  if (startDate > endDate) {
    throw badRequest("Invalid date range, start date must be before end date!");
  }
  return { $gte: new Date(startDate), $lte: new Date(endDate) };
}

export const purchasesRoutes: FastifyPluginAsync = async (app) => {
  // GET /purchases - list all
  app.get<{ Querystring: PurchasesQuery }>(
    "/",
    { schema: { querystring: purchasesQuerySchema } },
    async (req, reply) => {
      const { startDate, endDate } = req.query;

      const dbQuery: { purchaseDate?: { $gte: Date; $lte: Date } } = {};

      const purchaseDate = purchaseDateFilter(startDate, endDate);
      if (purchaseDate) {
        dbQuery.purchaseDate = purchaseDate;
      }

      const purchases = await Purchase.find(dbQuery)
        .populate(SUPPLIER_POPULATE)
        .populate(PURCHASE_ITEMS_POPULATE)
        .lean();

      if (!purchases?.length) {
        throw notFound("No purchases found");
      }
      return reply.code(200).send(purchases);
    },
  );

  // POST /purchases - create (transaction)
  app.post<{ Body: CreatePurchaseBody }>(
    "/",
    { schema: { body: createPurchaseBodySchema } },
    async (req, reply) => {
      const {
        supplierId,
        purchaseDate,
        businessId,
        purchasedByEmployeeId,
        receiptId,
        title,
        purchaseInventoryItems,
        comment,
      } = req.body;

      const totalAmount = purchaseInventoryItems.reduce(
        (acc, item) => acc + item.purchasePrice,
        0,
      );

      const isOneTimePurchase = supplierId === ONE_TIME_PURCHASE_SUPPLIER;

      const newPurchaseInventoryItems: IPurchaseItem[] =
        purchaseInventoryItems.map((item) => ({
          supplierGoodId: item.supplierGoodId as unknown as Types.ObjectId,
          quantityPurchased: item.quantityPurchased,
          purchasePrice: item.purchasePrice,
        }));

      let newSupplierId: Types.ObjectId;
      if (isOneTimePurchase) {
        if (!comment) {
          throw badRequest("Comment is required for one time purchase!");
        }

        const createOneTimePurchaseSupplierResult =
          await oneTimePurchaseSupplier(businessId);

        const parsedSupplierId = objectIdSchema.safeParse(
          String(createOneTimePurchaseSupplierResult),
        );
        if (!parsedSupplierId.success) {
          throw badRequest("SupplierId not valid!");
        }
        newSupplierId = new Types.ObjectId(parsedSupplierId.data);

        newPurchaseInventoryItems.forEach((item) => {
          item.supplierGoodId = newSupplierId;
        });
      } else {
        newSupplierId = new Types.ObjectId(supplierId);
      }

      const arePurchaseItemsValid = validateInventoryPurchaseItems(
        newPurchaseInventoryItems,
        isOneTimePurchase,
      );
      if (arePurchaseItemsValid !== true) {
        throw badRequest("Purchase items array of objects not valid!");
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const existingReceiptId = await Purchase.exists({
          receiptId,
          businessId,
          supplierId: newSupplierId,
        }).session(session);
        if (existingReceiptId) {
          throw badRequest("Receipt Id already exists!");
        }

        const newPurchase = {
          title: title ? title : "Purchase without title!",
          supplierId: newSupplierId,
          purchaseDate,
          businessId,
          purchasedByEmployeeId,
          purchaseInventoryItems: newPurchaseInventoryItems,
          oneTimePurchase: isOneTimePurchase,
          totalAmount,
          receiptId,
          comment: comment ? comment : undefined,
        };

        const newPurchaseResult = await Purchase.create([newPurchase], {
          session,
        });

        if (!newPurchaseResult) {
          throw badRequest("Purchase creation failed!");
        }

        const bulkOperations = newPurchaseInventoryItems.map((item) => {
          const { supplierGoodId, quantityPurchased } = item;
          return {
            updateOne: {
              filter: {
                businessId,
                "inventoryGoods.supplierGoodId": supplierGoodId,
                setFinalCount: false,
              },
              update: {
                $inc: {
                  "inventoryGoods.$.dynamicSystemCount": quantityPurchased,
                },
              },
            },
          };
        });

        const bulkResult = await Inventory.bulkWrite(bulkOperations, {
          session,
        });

        if (bulkResult.ok !== 1) {
          throw notFound("Inventory not found or bulk update failed.");
        }

        await session.commitTransaction();

        return reply.code(201).send({
          message: "Purchase created and inventory updated",
        });
      } catch (error) {
        await session.abortTransaction().catch(() => undefined);
        throw error;
      } finally {
        session.endSession();
      }
    },
  );

  // GET /purchases/:purchaseId - get by ID
  app.get<{ Params: PurchaseIdParams }>(
    "/:purchaseId",
    { schema: { params: purchaseIdParamsSchema } },
    async (req, reply) => {
      const { purchaseId } = req.params;

      const purchase = await Purchase.findById(purchaseId)
        .populate(SUPPLIER_POPULATE)
        .populate(PURCHASE_ITEMS_POPULATE)
        .lean();

      if (!purchase) {
        throw notFound("Purchase not found!");
      }
      return reply.code(200).send(purchase);
    },
  );

  // PATCH /purchases/:purchaseId - update (multipart with documents, or JSON)
  app.patch<{ Params: PurchaseIdParams }>(
    "/:purchaseId",
    { schema: { params: purchaseIdParamsSchema } },
    async (req, reply) => {
      const { purchaseId } = req.params;

      let fields: UpdatePurchaseBody;
      let uploadedFiles: MultipartFile[] = [];
      if (req.isMultipart()) {
        const parsed = await parseMultipart(req, updatePurchaseBodySchema);
        fields = parsed.fields;
        uploadedFiles = parsed.files;
      } else {
        fields = validateFields(req.body, updatePurchaseBodySchema);
      }

      const {
        title,
        purchaseDate,
        businessId,
        purchasedByEmployeeId,
        receiptId,
      } = fields;

      // Multipart upload: upload files and update documentsUrl.
      if (uploadedFiles.length > 0) {
        const folder = `/business/${businessId}/purchases/${purchaseId}`;

        const cloudinaryUploadResponse = await uploadFilesCloudinary({
          folder,
          filesArr: uploadedFiles.map((file) => ({
            buffer: file.buffer,
            mimeType: file.mimetype,
          })),
          // Purchases can include docs and images; don't restrict type here.
          onlyImages: false,
        });

        if (
          typeof cloudinaryUploadResponse === "string" ||
          cloudinaryUploadResponse.length === 0 ||
          !cloudinaryUploadResponse.every(
            (url) => typeof url === "string" && url.includes("https://"),
          )
        ) {
          throw badRequest(
            `Error uploading purchase documents: ${cloudinaryUploadResponse}`,
          );
        }

        const purchase = await Purchase.findById(purchaseId).lean();
        const existingDocs =
          (purchase as unknown as { documentsUrl?: string[] })?.documentsUrl ??
          [];
        for (const url of existingDocs) {
          // Best-effort delete old assets.
          // eslint-disable-next-line no-await-in-loop
          await deleteFilesCloudinary(url);
        }

        // Overwrite documentsUrl with newly uploaded assets.
        const updatedPurchase = await Purchase.findByIdAndUpdate(
          purchaseId,
          {
            $set: {
              ...(title ? { title } : {}),
              ...(purchaseDate ? { purchaseDate } : {}),
              ...(purchasedByEmployeeId ? { purchasedByEmployeeId } : {}),
              ...(receiptId ? { receiptId } : {}),
              documentsUrl: cloudinaryUploadResponse,
            },
          },
          { returnDocument: "after", lean: true },
        );

        if (!updatedPurchase) {
          throw notFound("Purchase not found!");
        }

        return reply.code(200).send({
          message: "Purchase updated successfully!",
        });
      }

      if (receiptId) {
        const existingReceiptId = await Purchase.exists({
          _id: { $ne: purchaseId },
          receiptId,
          businessId,
        });
        if (existingReceiptId) {
          throw badRequest("Receipt Id already exists!");
        }
      }

      const updatePurchaseObj: Record<string, unknown> = {};

      if (title) updatePurchaseObj.title = title;
      if (purchaseDate) updatePurchaseObj.purchaseDate = purchaseDate;
      if (purchasedByEmployeeId)
        updatePurchaseObj.purchasedByEmployeeId = purchasedByEmployeeId;
      if (receiptId) updatePurchaseObj.receiptId = receiptId;

      const updatedPurchase = await Purchase.findByIdAndUpdate(
        purchaseId,
        { $set: updatePurchaseObj },
        { returnDocument: "after", lean: true },
      );

      if (!updatedPurchase) {
        throw notFound("Purchase not found!");
      }

      return reply.code(200).send({
        message: "Purchase updated successfully!",
      });
    },
  );

  // DELETE /purchases/:purchaseId - delete (transaction)
  app.delete<{ Params: PurchaseIdParams }>(
    "/:purchaseId",
    { schema: { params: purchaseIdParamsSchema } },
    async (req, reply) => {
      const { purchaseId } = req.params;

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const purchase = (await Purchase.findById(purchaseId)
          .select("businessId purchaseInventoryItems")
          .session(session)
          .lean()) as unknown as IPurchase | null;

        if (!purchase) {
          throw notFound("Purchase not found!");
        }

        const result = await Purchase.deleteOne({ _id: purchaseId }).session(
          session,
        );

        if (result.deletedCount === 0) {
          throw notFound("Purchase not found!");
        }

        const bulkWriteOperations = purchase.purchaseInventoryItems?.map(
          (item) => {
            return {
              updateOne: {
                filter: {
                  businessId: purchase.businessId,
                  setFinalCount: false,
                  "inventoryGoods.supplierGoodId": item.supplierGoodId,
                },
                update: {
                  $inc: {
                    "inventoryGoods.$.dynamicSystemCount":
                      -item.quantityPurchased,
                  },
                },
              },
            };
          },
        );

        if (bulkWriteOperations && bulkWriteOperations.length > 0) {
          const updatedInventory = await Inventory.bulkWrite(
            bulkWriteOperations,
            { session },
          );

          if (updatedInventory.ok !== 1) {
            throw internal("Inventory update failed!");
          }
        }

        await session.commitTransaction();

        return reply.code(200).send(`Purchase ${purchaseId} deleted`);
      } catch (error) {
        await session.abortTransaction().catch(() => undefined);
        throw error;
      } finally {
        session.endSession();
      }
    },
  );

  // PATCH /purchases/:purchaseId/addSupplierGood - add item (transaction)
  app.patch<{ Params: PurchaseIdParams; Body: AddPurchaseItemBody }>(
    "/:purchaseId/addSupplierGood",
    {
      schema: {
        params: purchaseIdParamsSchema,
        body: addPurchaseItemBodySchema,
      },
    },
    async (req, reply) => {
      const { purchaseId } = req.params;
      const { supplierGoodId, quantityPurchased, purchasePrice } = req.body;

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const updatePurchase = (await Purchase.findOneAndUpdate(
          { _id: purchaseId },
          {
            $push: {
              purchaseInventoryItems: {
                supplierGoodId,
                quantityPurchased,
                purchasePrice,
              },
            },
            $inc: { totalAmount: purchasePrice },
          },
          { returnDocument: "after", session },
        ).lean()) as unknown as IPurchase | null;

        if (!updatePurchase) {
          throw notFound("Purchase not found!");
        }

        const updatedInventory = await Inventory.findOneAndUpdate(
          {
            businessId: updatePurchase.businessId,
            "inventoryGoods.supplierGoodId": supplierGoodId,
            setFinalCount: false,
          },
          {
            $inc: {
              "inventoryGoods.$.dynamicSystemCount": quantityPurchased,
            },
          },
          { returnDocument: "after", lean: true, session },
        );

        if (!updatedInventory) {
          throw notFound("Inventory not found or update failed.");
        }

        await session.commitTransaction();

        return reply.code(200).send({
          message: "SupplierGood added to purchase successfully!",
        });
      } catch (error) {
        await session.abortTransaction().catch(() => undefined);
        throw error;
      } finally {
        session.endSession();
      }
    },
  );

  // PATCH /purchases/:purchaseId/deleteSupplierGood - remove item (transaction)
  app.patch<{ Params: PurchaseIdParams; Body: DeletePurchaseItemBody }>(
    "/:purchaseId/deleteSupplierGood",
    {
      schema: {
        params: purchaseIdParamsSchema,
        body: deletePurchaseItemBodySchema,
      },
    },
    async (req, reply) => {
      const { purchaseId } = req.params;
      const { purchaseInventoryItemsId } = req.body;

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const purchaseItem = (await Purchase.findOne(
          {
            _id: purchaseId,
            "purchaseInventoryItems._id": purchaseInventoryItemsId,
          },
          {
            businessId: 1,
            "purchaseInventoryItems.$": 1,
          },
        )
          .session(session)
          .lean()) as unknown as IPurchase | null;

        if (!purchaseItem) {
          throw notFound("Purchase item not found!");
        }

        const quantityPurchased =
          purchaseItem?.purchaseInventoryItems?.[0].quantityPurchased ?? 0;

        const updatePurchase = await Purchase.findOneAndUpdate(
          { _id: purchaseId },
          {
            $pull: {
              purchaseInventoryItems: { _id: purchaseInventoryItemsId },
            },
            $inc: { totalAmount: -quantityPurchased },
          },
          { returnDocument: "after", lean: true, session },
        ).select("businessId");

        const updatedInventory = await Inventory.findOneAndUpdate(
          {
            businessId: purchaseItem.businessId,
            "inventoryGoods.supplierGoodId":
              purchaseItem?.purchaseInventoryItems?.[0].supplierGoodId,
            setFinalCount: false,
          },
          {
            $inc: {
              "inventoryGoods.$.dynamicSystemCount": -quantityPurchased,
            },
          },
          { returnDocument: "after", lean: true, session },
        );

        if (!updatePurchase) {
          throw notFound("SupplierGood not found or delete failed!");
        }

        if (!updatedInventory) {
          throw notFound("Inventory not found or update failed.");
        }

        await session.commitTransaction();

        return reply.code(200).send({
          message: "SupplierGood added to purchase successfully!",
        });
      } catch (error) {
        await session.abortTransaction().catch(() => undefined);
        throw error;
      } finally {
        session.endSession();
      }
    },
  );

  // PATCH /purchases/:purchaseId/editSupplierGood - edit item (transaction)
  app.patch<{ Params: PurchaseIdParams; Body: EditPurchaseItemBody }>(
    "/:purchaseId/editSupplierGood",
    {
      preValidation: [createOptionalAuthHook(app)],
      schema: {
        params: purchaseIdParamsSchema,
        body: editPurchaseItemBodySchema,
      },
    },
    async (req, reply) => {
      const { purchaseId } = req.params;
      const {
        purchaseInventoryItemsId,
        newQuantityPurchased,
        newPurchasePrice,
        reason,
      } = req.body;

      if (!req.authSession) {
        throw unauthorized("Authentication required");
      }
      const userIdObj = new Types.ObjectId(req.authSession.id);

      const purchaseItem = (await Purchase.findOne(
        {
          _id: purchaseId,
          "purchaseInventoryItems._id": purchaseInventoryItemsId,
        },
        {
          businessId: 1,
          "purchaseInventoryItems.$": 1,
        },
      ).lean()) as unknown as IPurchase | null;

      if (!purchaseItem) {
        throw notFound("Purchase item not found!");
      }

      const businessId =
        typeof purchaseItem.businessId === "object" &&
        purchaseItem.businessId !== null &&
        "_id" in purchaseItem.businessId
          ? (purchaseItem.businessId as { _id: Types.ObjectId })._id
          : (purchaseItem.businessId as Types.ObjectId);

      const employee = (await Employee.findOne({
        userId: userIdObj,
        businessId,
      })
        .select("_id currentShiftRole businessId")
        .lean()) as IEmployee | null;

      if (
        !employee ||
        !managementRolesEnums.includes(
          employee.currentShiftRole as (typeof managementRolesEnums)[number],
        )
      ) {
        throw forbidden("You are not allowed to edit purchase lines!");
      }

      if (
        purchaseItem.businessId &&
        employee.businessId?.toString() !== purchaseItem.businessId.toString()
      ) {
        throw forbidden("Purchase does not belong to your business!");
      }

      await runTxnWithTransientRetry(async (session) => {
        const previousQuantity =
          purchaseItem?.purchaseInventoryItems?.[0].quantityPurchased ?? 0;
        const previousPrice =
          purchaseItem?.purchaseInventoryItems?.[0].purchasePrice ?? 0;

        const now = new Date();
        const updatePurchase = await Purchase.findOneAndUpdate(
          {
            _id: purchaseId,
            "purchaseInventoryItems._id": purchaseInventoryItemsId,
          },
          {
            $set: {
              "purchaseInventoryItems.$.quantityPurchased":
                newQuantityPurchased,
              "purchaseInventoryItems.$.purchasePrice": newPurchasePrice,
              "purchaseInventoryItems.$.lastEditByEmployeeId": employee._id,
              "purchaseInventoryItems.$.lastEditReason": reason,
              "purchaseInventoryItems.$.lastEditDate": now,
              "purchaseInventoryItems.$.lastEditOriginalQuantity":
                previousQuantity,
              "purchaseInventoryItems.$.lastEditOriginalPrice": previousPrice,
            },
            $inc: {
              totalAmount: (newPurchasePrice ?? 0) - previousPrice,
            },
          },
          { returnDocument: "after", lean: true, session },
        ).select("businessId");

        if (!updatePurchase) {
          throw notFound("Purchase not found!");
        }

        const updatedInventory = await Inventory.findOneAndUpdate(
          {
            businessId: purchaseItem.businessId,
            "inventoryGoods.supplierGoodId":
              purchaseItem?.purchaseInventoryItems?.[0].supplierGoodId,
            setFinalCount: false,
          },
          {
            $inc: {
              "inventoryGoods.$.dynamicSystemCount":
                (newQuantityPurchased ?? 0) - previousQuantity,
            },
          },
          { returnDocument: "after", lean: true, session },
        );

        if (!updatedInventory) {
          throw notFound("Inventory not found or update failed.");
        }

        return { type: "commit" as const, value: undefined };
      });

      return reply.code(200).send({
        message: "Supplier good line updated successfully!",
      });
    },
  );

  // GET /purchases/supplier/:supplierId - get by supplier
  app.get<{ Params: PurchaseBySupplierParams; Querystring: PurchasesQuery }>(
    "/supplier/:supplierId",
    {
      schema: {
        params: purchaseBySupplierParamsSchema,
        querystring: purchasesQuerySchema,
      },
    },
    async (req, reply) => {
      const { supplierId } = req.params;
      const { startDate, endDate } = req.query;

      interface SupplierQuery {
        supplierId: Types.ObjectId;
        purchaseDate?: { $gte: Date; $lte: Date };
      }

      const dbQuery: SupplierQuery = {
        supplierId: new Types.ObjectId(supplierId),
      };

      const purchaseDate = purchaseDateFilter(startDate, endDate);
      if (purchaseDate) {
        dbQuery.purchaseDate = purchaseDate;
      }

      const purchase = await Purchase.find(dbQuery)
        .populate(SUPPLIER_POPULATE)
        .populate(PURCHASE_ITEMS_POPULATE)
        .lean();

      if (!purchase || purchase.length === 0) {
        throw notFound("Purchase not found!");
      }
      return reply.code(200).send(purchase);
    },
  );

  // GET /purchases/user/:userId - get by user
  app.get<{ Params: PurchaseByUserParams; Querystring: PurchasesQuery }>(
    "/user/:userId",
    {
      schema: {
        params: purchaseByUserParamsSchema,
        querystring: purchasesQuerySchema,
      },
    },
    async (req, reply) => {
      const { userId } = req.params;
      const { startDate, endDate } = req.query;

      const employees = await Employee.find({
        userId: new Types.ObjectId(userId),
      })
        .select("_id")
        .lean();
      const employeeIds = employees.map((e) => e._id as Types.ObjectId);
      if (employeeIds.length === 0) {
        throw notFound("Purchase not found!");
      }

      interface UserQuery {
        purchasedByEmployeeId: { $in: Types.ObjectId[] };
        purchaseDate?: { $gte: Date; $lte: Date };
      }

      const dbQuery: UserQuery = { purchasedByEmployeeId: { $in: employeeIds } };

      const purchaseDate = purchaseDateFilter(startDate, endDate);
      if (purchaseDate) {
        dbQuery.purchaseDate = purchaseDate;
      }

      const purchase = await Purchase.find(dbQuery)
        .populate(SUPPLIER_POPULATE)
        .populate(PURCHASE_ITEMS_POPULATE)
        .lean();

      if (!purchase || purchase.length === 0) {
        throw notFound("Purchase not found!");
      }
      return reply.code(200).send(purchase);
    },
  );
};

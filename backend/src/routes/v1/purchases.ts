import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type { IPurchase, IPurchaseItem } from "../../../../lib/interface/IPurchase.ts";
import type { IEmployee } from "../../../../lib/interface/IEmployee.ts";

import isObjectIdValid from "../../utils/isObjectIdValid.ts";
import { managementRolesEnums } from "../../../../lib/enums.ts";
import validateInventoryPurchaseItems from "../../purchases/validateInventoryPurchaseItems.ts";
import oneTimePurchaseSupplier from "../../suppliers/oneTimePurchaseSupplier.ts";
import Purchase from "../../models/purchase.ts";
import Inventory from "../../models/inventory.ts";
import Supplier from "../../models/supplier.ts";
import SupplierGood from "../../models/supplierGood.ts";
import Employee from "../../models/employee.ts";
import { createAuthHook } from "../../auth/middleware.ts";

export const purchasesRoutes: FastifyPluginAsync = async (app) => {
  // GET /purchases - list all
  app.get("/", async (req, reply) => {
    const query = req.query as { startDate?: string; endDate?: string };
    const { startDate, endDate } = query;

    const dbQuery: { purchaseDate?: { $gte: Date; $lte: Date } } = {};

    if (startDate && endDate) {
      if (startDate > endDate) {
        return reply.code(400).send({
          message: "Invalid date range, start date must be before end date!",
        });
      }
      dbQuery.purchaseDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const purchases = await Purchase.find(dbQuery)
      .populate({
        path: "supplierId",
        select: "tradeName",
        model: Supplier,
      })
      .populate({
        path: "purchaseInventoryItems.supplierGoodId",
        select:
          "name mainCategory subCategory measurementUnit pricePerMeasurementUnit",
        model: SupplierGood,
      })
      .lean();

    if (!purchases?.length) {
      return reply.code(404).send({ message: "No purchases found" });
    }
    return reply.code(200).send(purchases);
  });

  // POST /purchases - create (transaction)
  app.post("/", async (req, reply) => {
    const {
      supplierId,
      purchaseDate,
      businessId,
      purchasedByEmployeeId,
      receiptId,
      title,
      purchaseInventoryItems,
      comment,
    } = req.body as IPurchase;

    if (
      !supplierId ||
      !purchaseDate ||
      !businessId ||
      !purchasedByEmployeeId ||
      !purchaseInventoryItems ||
      !receiptId
    ) {
      return reply.code(400).send({
        message:
          "SupplierId, purchaseDate, businessId, purchasedByEmployeeId, purchaseInventoryItems and reciptId are required!",
      });
    }

    if (!isObjectIdValid([businessId, purchasedByEmployeeId])) {
      return reply.code(400).send({
        message: "Business or employee IDs not valid!",
      });
    }

    const totalAmount = purchaseInventoryItems.reduce(
      (acc: number, item: IPurchaseItem) => acc + item.purchasePrice,
      0
    );

    let newSupplierId: Types.ObjectId = supplierId as Types.ObjectId;
    const newPurchaseInventoryItems = purchaseInventoryItems;

    if (supplierId.toString() === "One Time Purchase") {
      if (!comment) {
        return reply.code(400).send({
          message: "Comment is required for one time purchase!",
        });
      }

      const createOneTimePurchaseSupplierResult = await oneTimePurchaseSupplier(
        businessId
      );

      if (!isObjectIdValid([createOneTimePurchaseSupplierResult])) {
        return reply.code(400).send({
          message: "SupplierId not valid!",
        });
      }
      newSupplierId = createOneTimePurchaseSupplierResult as Types.ObjectId;

      newPurchaseInventoryItems.forEach((item: IPurchaseItem) => {
        item.supplierGoodId = newSupplierId;
      });
    }

    const isOneTimePurchase = supplierId.toString() === "One Time Purchase";

    const arePurchaseItemsValid = validateInventoryPurchaseItems(
      purchaseInventoryItems,
      isOneTimePurchase
    );
    if (arePurchaseItemsValid !== true) {
      return reply.code(400).send({
        message: "Purchase items array of objects not valid!",
      });
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
        await session.abortTransaction();
        return reply.code(400).send({ message: "Receipt Id already exists!" });
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

      const newPurchaseResult = await Purchase.create([newPurchase], { session });

      if (!newPurchaseResult) {
        await session.abortTransaction();
        return reply.code(400).send({ message: "Purchase creation failed!" });
      }

      const bulkOperations = newPurchaseInventoryItems.map(
        (item: IPurchaseItem) => {
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
        }
      );

      const bulkResult = await Inventory.bulkWrite(bulkOperations, { session });

      if (bulkResult.ok !== 1) {
        await session.abortTransaction();
        return reply.code(404).send({
          message: "Inventory not found or bulk update failed.",
        });
      }

      await session.commitTransaction();

      return reply.code(201).send({
        message: "Purchase created and inventory updated",
      });
    } catch (error) {
      await session.abortTransaction();
      return reply.code(500).send({
        message: "Create new purchase failed!",
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      session.endSession();
    }
  });

  // GET /purchases/:purchaseId - get by ID
  app.get("/:purchaseId", async (req, reply) => {
    const params = req.params as { purchaseId?: string };
    const purchaseId = params.purchaseId;

    if (!purchaseId || isObjectIdValid([purchaseId]) !== true) {
      return reply.code(400).send({ message: "Purchase ID not valid!" });
    }

    const purchase = await Purchase.findById(purchaseId)
      .populate({
        path: "supplierId",
        select: "tradeName",
        model: Supplier,
      })
      .populate({
        path: "purchaseInventoryItems.supplierGoodId",
        select:
          "name mainCategory subCategory measurementUnit pricePerMeasurementUnit",
        model: SupplierGood,
      })
      .lean();

    if (!purchase) {
      return reply.code(404).send({ message: "Purchase not found!" });
    }
    return reply.code(200).send(purchase);
  });

  // PATCH /purchases/:purchaseId - update (transaction)
  app.patch("/:purchaseId", async (req, reply) => {
    const params = req.params as { purchaseId?: string };
    const purchaseId = params.purchaseId;

    const { title, purchaseDate, businessId, purchasedByEmployeeId, receiptId } =
      req.body as IPurchase;

    if (!businessId) {
      return reply.code(400).send({ message: "Business ID is required!" });
    }

    if (isObjectIdValid([businessId, purchasedByEmployeeId]) !== true) {
      return reply.code(400).send({
        message: "Supplier, business or employee IDs not valid!",
      });
    }

    try {
      if (receiptId) {
        const existingReceiptId = await Purchase.exists({
          _id: { $ne: purchaseId },
          receiptId,
          businessId,
        });
        if (existingReceiptId) {
          return reply.code(400).send({ message: "Receipt Id already exists!" });
        }
      }

      const updatePurchaseObj: Partial<IPurchase> = {};

      if (title) updatePurchaseObj.title = title;
      if (purchaseDate) updatePurchaseObj.purchaseDate = purchaseDate;
      if (purchasedByEmployeeId)
        updatePurchaseObj.purchasedByEmployeeId = purchasedByEmployeeId;
      if (receiptId) updatePurchaseObj.receiptId = receiptId;

      const updatedPurchase = await Purchase.findByIdAndUpdate(
        purchaseId,
        { $set: updatePurchaseObj },
        { new: true, lean: true }
      );

      if (!updatedPurchase) {
        return reply.code(404).send({ message: "Purchase not found!" });
      }

      return reply.code(200).send({
        message: "Purchase updated successfully!",
      });
    } catch (error) {
      return reply.code(500).send({
        message: "Update purchase failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // DELETE /purchases/:purchaseId - delete (transaction)
  app.delete("/:purchaseId", async (req, reply) => {
    const params = req.params as { purchaseId?: string };
    const purchaseId = params.purchaseId;

    if (!purchaseId || !isObjectIdValid([purchaseId])) {
      return reply.code(400).send({ message: "Purchase ID not valid!" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const purchase = (await Purchase.findById(purchaseId)
        .select("businessId purchaseInventoryItems")
        .session(session)
        .lean()) as unknown as IPurchase | null;

      if (!purchase) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "Purchase not found!" });
      }

      const result = await Purchase.deleteOne({ _id: purchaseId }).session(session);

      if (result.deletedCount === 0) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "Purchase not found!" });
      }

      const bulkWriteOperations = purchase.purchaseInventoryItems?.map((item) => {
        return {
          updateOne: {
            filter: {
              businessId: purchase.businessId,
              setFinalCount: false,
              "inventoryGoods.supplierGoodId": item.supplierGoodId,
            },
            update: {
              $inc: {
                "inventoryGoods.$.dynamicSystemCount": -item.quantityPurchased,
              },
            },
          },
        };
      });

      if (bulkWriteOperations && bulkWriteOperations.length > 0) {
        const updatedInventory = await Inventory.bulkWrite(bulkWriteOperations, {
          session,
        });

        if (updatedInventory.ok !== 1) {
          await session.abortTransaction();
          return reply.code(500).send({ message: "Inventory update failed!" });
        }
      }

      await session.commitTransaction();

      return reply.code(200).send(`Purchase ${purchaseId} deleted`);
    } catch (error) {
      await session.abortTransaction();
      return reply.code(500).send({
        message: "Delete purchase failed!",
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      session.endSession();
    }
  });

  // PATCH /purchases/:purchaseId/addSupplierGood - add item (transaction)
  app.patch("/:purchaseId/addSupplierGood", async (req, reply) => {
    const params = req.params as { purchaseId?: string };
    const purchaseId = params.purchaseId;

    const { supplierGoodId, quantityPurchased, purchasePrice } = req.body as {
      supplierGoodId?: string;
      quantityPurchased?: number;
      purchasePrice?: number;
    };

    if (!supplierGoodId || isObjectIdValid([supplierGoodId]) !== true) {
      return reply.code(400).send({
        message: "Purchase or supplier ID not valid!",
      });
    }

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
        { new: true, session }
      ).lean()) as unknown as IPurchase | null;

      if (!updatePurchase) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "Purchase not found!" });
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
        { new: true, lean: true, session }
      );

      if (!updatedInventory) {
        await session.abortTransaction();
        return reply.code(404).send({
          message: "Inventory not found or update failed.",
        });
      }

      await session.commitTransaction();

      return reply.code(200).send({
        message: "SupplierGood added to purchase successfully!",
      });
    } catch (error) {
      await session.abortTransaction();
      return reply.code(500).send({
        message: "Add supplierGood to purchase failed!",
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      session.endSession();
    }
  });

  // PATCH /purchases/:purchaseId/deleteSupplierGood - remove item (transaction)
  app.patch("/:purchaseId/deleteSupplierGood", async (req, reply) => {
    const params = req.params as { purchaseId?: string };
    const purchaseId = params.purchaseId;

    const { purchaseInventoryItemsId } = req.body as {
      purchaseInventoryItemsId?: string;
    };

    if (!purchaseId || isObjectIdValid([purchaseId]) !== true) {
      return reply.code(400).send({
        message: "Purchase or supplier ID not valid!",
      });
    }

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
        }
      )
        .session(session)
        .lean()) as unknown as IPurchase | null;

      if (!purchaseItem) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "Purchase item not found!" });
      }

      const quantityPurchased =
        purchaseItem?.purchaseInventoryItems?.[0].quantityPurchased ?? 0;

      const [updatePurchase, updatedInventory] = await Promise.all([
        Purchase.findOneAndUpdate(
          { _id: purchaseId },
          {
            $pull: { purchaseInventoryItems: { _id: purchaseInventoryItemsId } },
            $inc: { totalAmount: -quantityPurchased },
          },
          { new: true, lean: true, session }
        ).select("businessId"),

        Inventory.findOneAndUpdate(
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
          { new: true, lean: true, session }
        ),
      ]);

      if (!updatePurchase) {
        await session.abortTransaction();
        return reply.code(404).send({
          message: "SupplierGood not found or delete failed!",
        });
      }

      if (!updatedInventory) {
        await session.abortTransaction();
        return reply.code(404).send({
          message: "Inventory not found or update failed.",
        });
      }

      await session.commitTransaction();

      return reply.code(200).send({
        message: "SupplierGood added to purchase successfully!",
      });
    } catch (error) {
      await session.abortTransaction();
      return reply.code(500).send({
        message: "Add supplierGood to purchase failed!",
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      session.endSession();
    }
  });

  // PATCH /purchases/:purchaseId/editSupplierGood - edit item (transaction)
  app.patch("/:purchaseId/editSupplierGood", { preValidation: [createAuthHook(app)] }, async (req, reply) => {
    const params = req.params as { purchaseId?: string };
    const purchaseId = params.purchaseId;

    const { purchaseInventoryItemsId, newQuantityPurchased, newPurchasePrice, reason } =
      req.body as {
        purchaseInventoryItemsId?: string;
        newQuantityPurchased?: number;
        newPurchasePrice?: number;
        reason?: string;
      };

    if (!reason || typeof reason !== "string" || reason.trim() === "") {
      return reply.code(400).send({
        message: "reason (non-empty) is required!",
      });
    }

    if (
      !purchaseId ||
      !purchaseInventoryItemsId ||
      isObjectIdValid([purchaseId, purchaseInventoryItemsId]) !== true
    ) {
      return reply.code(400).send({
        message: "Purchase or supplier ID not valid!",
      });
    }

    if (!req.authSession) {
      return reply.code(401).send({ message: "Unauthorized" });
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
      }
    ).lean()) as unknown as IPurchase | null;

    if (!purchaseItem) {
      return reply.code(404).send({ message: "Purchase item not found!" });
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
      !managementRolesEnums.includes(employee.currentShiftRole as (typeof managementRolesEnums)[number])
    ) {
      return reply.code(403).send({
        message: "You are not allowed to edit purchase lines!",
      });
    }

    if (
      purchaseItem.businessId &&
      employee.businessId?.toString() !== purchaseItem.businessId.toString()
    ) {
      return reply.code(403).send({
        message: "Purchase does not belong to your business!",
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const previousQuantity =
        purchaseItem?.purchaseInventoryItems?.[0].quantityPurchased ?? 0;
      const previousPrice =
        purchaseItem?.purchaseInventoryItems?.[0].purchasePrice ?? 0;

      const now = new Date();
      const [updatePurchase, updatedInventory] = await Promise.all([
        Purchase.findOneAndUpdate(
          {
            _id: purchaseId,
            "purchaseInventoryItems._id": purchaseInventoryItemsId,
          },
          {
            $set: {
              "purchaseInventoryItems.$.quantityPurchased": newQuantityPurchased,
              "purchaseInventoryItems.$.purchasePrice": newPurchasePrice,
              "purchaseInventoryItems.$.lastEditByEmployeeId": employee._id,
              "purchaseInventoryItems.$.lastEditReason": reason.trim(),
              "purchaseInventoryItems.$.lastEditDate": now,
              "purchaseInventoryItems.$.lastEditOriginalQuantity": previousQuantity,
              "purchaseInventoryItems.$.lastEditOriginalPrice": previousPrice,
            },
            $inc: {
              totalAmount: (newPurchasePrice ?? 0) - previousPrice,
            },
          },
          { new: true, lean: true, session }
        ).select("businessId"),

        Inventory.findOneAndUpdate(
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
          { new: true, lean: true, session }
        ),
      ]);

      if (!updatePurchase) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "Purchase not found!" });
      }

      if (!updatedInventory) {
        await session.abortTransaction();
        return reply.code(404).send({
          message: "Inventory not found or update failed.",
        });
      }

      await session.commitTransaction();

      return reply.code(200).send({
        message: "Supplier good line updated successfully!",
      });
    } catch (error) {
      await session.abortTransaction();
      return reply.code(500).send({
        message: "Add supplierGood to purchase failed!",
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      session.endSession();
    }
  });

  // GET /purchases/supplier/:supplierId - get by supplier
  app.get("/supplier/:supplierId", async (req, reply) => {
    const params = req.params as { supplierId?: string };
    const supplierId = params.supplierId;

    if (!supplierId || !isObjectIdValid([supplierId])) {
      return reply.code(400).send({ message: "Purchase ID not valid!" });
    }

    const query = req.query as { startDate?: string; endDate?: string };
    const { startDate, endDate } = query;

    interface SupplierQuery {
      supplierId: Types.ObjectId;
      purchaseDate?: { $gte: Date; $lte: Date };
    }

    const dbQuery: SupplierQuery = { supplierId: new Types.ObjectId(supplierId) };

    if (startDate && endDate) {
      if (startDate > endDate) {
        return reply.code(400).send({
          message: "Invalid date range, start date must be before end date!",
        });
      }
      dbQuery.purchaseDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const purchase = await Purchase.find(dbQuery)
      .populate({
        path: "supplierId",
        select: "tradeName",
        model: Supplier,
      })
      .populate({
        path: "purchaseInventoryItems.supplierGoodId",
        select:
          "name mainCategory subCategory measurementUnit pricePerMeasurementUnit",
        model: SupplierGood,
      })
      .lean();

    if (!purchase || purchase.length === 0) {
      return reply.code(404).send({ message: "Purchase not found!" });
    }
    return reply.code(200).send(purchase);
  });

  // GET /purchases/user/:userId - get by user
  app.get("/user/:userId", async (req, reply) => {
    const params = req.params as { userId?: string };
    const userId = params.userId;

    if (!userId || !isObjectIdValid([userId])) {
      return reply.code(400).send({ message: "User ID not valid!" });
    }

    const query = req.query as { startDate?: string; endDate?: string };
    const { startDate, endDate } = query;

    const employees = await Employee.find({ userId: new Types.ObjectId(userId) })
      .select("_id")
      .lean();
    const employeeIds = employees.map((e) => e._id as Types.ObjectId);
    if (employeeIds.length === 0) {
      return reply.code(404).send({ message: "Purchase not found!" });
    }

    interface UserQuery {
      purchasedByEmployeeId: { $in: Types.ObjectId[] };
      purchaseDate?: { $gte: Date; $lte: Date };
    }

    const dbQuery: UserQuery = { purchasedByEmployeeId: { $in: employeeIds } };

    if (startDate && endDate) {
      if (startDate > endDate) {
        return reply.code(400).send({
          message: "Invalid date range, start date must be before end date!",
        });
      }
      dbQuery.purchaseDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const purchase = await Purchase.find(dbQuery)
      .populate({
        path: "supplierId",
        select: "tradeName",
        model: Supplier,
      })
      .populate({
        path: "purchaseInventoryItems.supplierGoodId",
        select:
          "name mainCategory subCategory measurementUnit pricePerMeasurementUnit",
        model: SupplierGood,
      })
      .lean();

    if (!purchase || purchase.length === 0) {
      return reply.code(404).send({ message: "Purchase not found!" });
    }
    return reply.code(200).send(purchase);
  });
};

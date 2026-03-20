import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type { IInventory, IInventoryCount } from "@shared/interfaces/IInventory";
import type { ISupplierGood } from "@shared/interfaces/ISupplierGood";
import type { IEmployee } from "@shared/interfaces/IEmployee";

import { isObjectIdValid } from "../../utils/isObjectIdValid.ts";
import { MANAGEMENT_ROLES } from "../../utils/constants.ts";
import Inventory from "../../models/inventory.ts";
import SupplierGood from "../../models/supplierGood.ts";
import Supplier from "../../models/supplier.ts";
import Employee from "../../models/employee.ts";
import { createNextPeriodInventory } from "../../inventories/createNextPeriodInventory.ts";
import { getVarianceReport } from "../../inventories/getVarianceReport.ts";
import { createAuthHook } from "../../auth/middleware.ts";

export const inventoriesRoutes: FastifyPluginAsync = async (app) => {
  // GET /inventories - list all
  app.get("/", async (_req, reply) => {
    const inventories = await Inventory.find()
      .populate({
        path: "inventoryGoods.supplierGoodId",
        select:
          "name mainCategory subCategory supplierId budgetImpact imageUrl inventorySchedule parLevel measurementUnit pricePerMeasurementUnit",
        model: SupplierGood,
        populate: {
          path: "supplierId",
          select: "tradeName",
          model: Supplier,
        },
      })
      .lean();

    if (!inventories.length) {
      return reply.code(404).send({ message: "No inventories found" });
    }
    return reply.code(200).send(inventories);
  });

  // POST /inventories - create (transaction)
  app.post("/", async (req, reply) => {
    const { businessId } = req.body as { businessId?: string };

    if (!businessId || isObjectIdValid([businessId]) !== true) {
      return reply.code(400).send({ message: "Invalid business ID" });
    }

    const startOfCurrentMonth = new Date();
    startOfCurrentMonth.setDate(1);
    startOfCurrentMonth.setHours(0, 0, 0, 0);

    const endOfCurrentMonth = new Date(startOfCurrentMonth);
    endOfCurrentMonth.setMonth(endOfCurrentMonth.getMonth() + 1);
    endOfCurrentMonth.setMilliseconds(-1);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const currentMonthInventory: IInventory | null = await Inventory.findOne({
        businessId,
        createdAt: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth },
      })
        .select("setFinalCount")
        .session(session)
        .lean();

      if (currentMonthInventory) {
        await session.abortTransaction();
        return reply.code(400).send({
          message: "Inventory for the current month already exists!",
        });
      }

      const startOfPreviousMonth = new Date(startOfCurrentMonth);
      startOfPreviousMonth.setMonth(startOfPreviousMonth.getMonth() - 1);

      const endOfPreviousMonth = new Date(startOfCurrentMonth);
      endOfPreviousMonth.setMilliseconds(-1);

      const lastInventory: IInventory | null = await Inventory.findOneAndUpdate(
        {
          businessId,
          createdAt: { $gte: startOfPreviousMonth, $lte: endOfPreviousMonth },
        },
        {
          $set: { setFinalCount: true },
        },
        { new: true, session }
      ).lean();

      const supplierGoods = await SupplierGood.find({
        businessId,
        currentlyInUse: true,
      })
        .select("_id")
        .session(session)
        .lean();

      const inventoryGoodsArr = supplierGoods.map((supplierGood: { _id: Types.ObjectId }) => {
        const lastInventoryGood = lastInventory?.inventoryGoods.find(
          (good) => good.supplierGoodId.toString() === supplierGood._id.toString()
        );

        const dynamicSystemCount =
          lastInventoryGood && lastInventoryGood.monthlyCounts.length > 0
            ? lastInventoryGood.monthlyCounts.sort(
                (a, b) =>
                  new Date(b.countedDate ?? "").getTime() -
                  new Date(a.countedDate ?? "").getTime()
              )[0]?.currentCountQuantity || 0
            : 0;

        return {
          supplierGoodId: supplierGood._id,
          monthlyCounts: [],
          dynamicSystemCount,
        };
      });

      const newInventory: IInventory = {
        businessId: new Types.ObjectId(businessId),
        setFinalCount: false,
        inventoryGoods: inventoryGoodsArr,
      };

      const createdInventory = await Inventory.create([newInventory], { session });

      if (!createdInventory) {
        await session.abortTransaction();
        return reply.code(500).send({ message: "Failed to create inventory" });
      }

      await session.commitTransaction();

      return reply.code(201).send({ message: "Inventory created successfully" });
    } catch (error) {
      await session.abortTransaction();
      return reply.code(500).send({
        message: "Create inventory failed!",
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      session.endSession();
    }
  });

  // GET /inventories/:inventoryId - get by ID
  app.get("/:inventoryId", async (req, reply) => {
    const params = req.params as { inventoryId?: string };
    const inventoryId = params.inventoryId;

    if (!inventoryId || isObjectIdValid([inventoryId]) !== true) {
      return reply.code(400).send({ message: "Inventory ID not valid!" });
    }

    const inventory = await Inventory.findById(inventoryId)
      .populate({
        path: "inventoryGoods.supplierGoodId",
        select:
          "name mainCategory subCategory supplierId budgetImpact imageUrl inventorySchedule parLevel measurementUnit pricePerMeasurementUnit",
        model: SupplierGood,
        populate: {
          path: "supplierId",
          select: "tradeName",
          model: Supplier,
        },
      })
      .lean();

    if (!inventory) {
      return reply.code(404).send({ message: "No inventory found" });
    }
    return reply.code(200).send(inventory);
  });

  // DELETE /inventories/:inventoryId - delete
  app.delete("/:inventoryId", async (req, reply) => {
    const params = req.params as { inventoryId?: string };
    const inventoryId = params.inventoryId;

    if (!inventoryId || isObjectIdValid([inventoryId]) !== true) {
      return reply.code(400).send({ message: "Inventory ID not valid!" });
    }

    const result = await Inventory.deleteOne({ _id: inventoryId });

    if (result.deletedCount === 0) {
      return reply.code(404).send({ message: "Inventory not found!" });
    }

    return reply.code(200).send(`Inventory ${inventoryId} deleted`);
  });

  // PATCH /inventories/:inventoryId/close - close inventory (transaction)
  app.patch("/:inventoryId/close", { preValidation: [createAuthHook(app)] }, async (req, reply) => {
    const params = req.params as { inventoryId?: string };
    const inventoryId = params.inventoryId;

    if (!req.authSession) {
      return reply.code(401).send({ message: "Unauthorized" });
    }
    const userIdObj = new Types.ObjectId(req.authSession.id);

    if (!inventoryId || isObjectIdValid([inventoryId]) !== true) {
      return reply.code(400).send({ message: "Valid inventoryId is required" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const inventory = (await Inventory.findById(inventoryId)
        .select("businessId setFinalCount inventoryGoods")
        .lean()
        .session(session)) as IInventory | null;

      if (!inventory) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "Inventory not found" });
      }

      const businessId = inventory.businessId as Types.ObjectId;
      const employee = (await Employee.findOne({
        userId: userIdObj,
        businessId,
      })
        .select("currentShiftRole businessId")
        .lean()
        .session(session)) as IEmployee | null;

      if (!employee) {
        await session.abortTransaction();
        return reply.code(403).send({ message: "Employee not found for this business" });
      }

      if (!MANAGEMENT_ROLES.includes(employee.currentShiftRole ?? "")) {
        await session.abortTransaction();
        return reply.code(403).send({
          message: "You are not allowed to close the inventory!",
        });
      }

      if (employee.businessId?.toString() !== businessId.toString()) {
        await session.abortTransaction();
        return reply.code(403).send({ message: "Inventory does not belong to your business" });
      }

      if (inventory.setFinalCount) {
        await session.abortTransaction();
        return reply.code(400).send({ message: "Inventory is already closed" });
      }

      await Inventory.updateOne(
        { _id: inventoryId },
        { $set: { setFinalCount: true } },
        { session }
      );

      await createNextPeriodInventory(businessId, inventory as IInventory, session);

      await session.commitTransaction();

      return reply.code(200).send({
        message: "Inventory closed successfully and next period inventory created",
      });
    } catch (error) {
      await session.abortTransaction();
      return reply.code(500).send({
        message: "Close inventory failed!",
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      session.endSession();
    }
  });

  // GET /inventories/:inventoryId/supplierGood/:supplierGoodId - get supplier good in inventory
  app.get("/:inventoryId/supplierGood/:supplierGoodId", async (req, reply) => {
    const params = req.params as { inventoryId?: string; supplierGoodId?: string };
    const { inventoryId, supplierGoodId } = params;

    if (!inventoryId || !supplierGoodId || !isObjectIdValid([inventoryId, supplierGoodId])) {
      return reply.code(400).send({ message: "Inventory or supplier good ID not valid!" });
    }

    const query = req.query as { monthDate?: string };
    const monthDateParams = query.monthDate;

    const startDate = monthDateParams ? new Date(monthDateParams) : null;
    let endDate = monthDateParams ? new Date(monthDateParams) : null;

    if (startDate) {
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    }

    if (endDate) {
      endDate = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
    }

    interface InventoryQuery {
      _id: Types.ObjectId;
      "inventoryGoods.supplierGoodId": Types.ObjectId;
      createdAt?: { $gte: Date; $lte: Date };
    }

    const dbQuery: InventoryQuery = {
      _id: new Types.ObjectId(inventoryId),
      "inventoryGoods.supplierGoodId": new Types.ObjectId(supplierGoodId),
    };

    if (startDate && endDate) {
      dbQuery.createdAt = { $gte: startDate, $lte: endDate };
    }

    const inventories = await Inventory.find(dbQuery)
      .select("inventoryGoods.$")
      .populate({
        path: "inventoryGoods.supplierGoodId",
        select:
          "name mainCategory subCategory supplierId budgetImpact imageUrl inventorySchedule parLevel measurementUnit pricePerMeasurementUnit",
        model: SupplierGood,
        populate: {
          path: "supplierId",
          select: "tradeName",
          model: Supplier,
        },
      })
      .lean();

    if (!inventories.length) {
      return reply.code(404).send({ message: "No inventories found!" });
    }
    return reply.code(200).send(inventories);
  });

  // PATCH /inventories/:inventoryId/supplierGood/:supplierGoodId/addCount - add count
  app.patch("/:inventoryId/supplierGood/:supplierGoodId/addCount", async (req, reply) => {
    const params = req.params as { inventoryId?: string; supplierGoodId?: string };
    const { inventoryId, supplierGoodId } = params;

    const { currentCountQuantity, countedByEmployeeId, comments } = req.body as {
      currentCountQuantity?: number;
      countedByEmployeeId?: string;
      comments?: string;
    };

    if (!inventoryId || !supplierGoodId || !currentCountQuantity) {
      return reply.code(400).send({
        message: "InventoryId, supplierGoodId and currentCountQuantity are required!",
      });
    }

    if (!isObjectIdValid([inventoryId, supplierGoodId, countedByEmployeeId || ""])) {
      return reply.code(400).send({ message: "InventoryId or supplierGoodId not valid!" });
    }

    try {
      const [inventory, supplierGood] = await Promise.all([
        Inventory.findOne({
          _id: inventoryId,
          "inventoryGoods.supplierGoodId": supplierGoodId,
        })
          .select("setFinalCount inventoryGoods.$")
          .lean() as Promise<IInventory | null>,
        SupplierGood.findById(supplierGoodId)
          .select("parLevel")
          .lean() as Promise<ISupplierGood | null>,
      ]);

      if (!supplierGood || !inventory) {
        const message = !supplierGood ? "Supplier good not found!" : "Inventory not found!";
        return reply.code(400).send({ message });
      }

      if (inventory.setFinalCount) {
        return reply.code(400).send({
          message: "Inventory already set as final count! Cannot update!",
        });
      }

      const inventoryGood = inventory.inventoryGoods[0];

      if (currentCountQuantity === inventoryGood.dynamicSystemCount) {
        return reply.code(200).send({
          message: "Inventory count didn't change from last count!",
        });
      }

      const newInventoryCount: IInventoryCount = {
        currentCountQuantity,
        quantityNeeded: (supplierGood.parLevel || 0) - currentCountQuantity,
        countedByEmployeeId: new Types.ObjectId(countedByEmployeeId!),
        deviationPercent:
          ((inventoryGood.dynamicSystemCount - currentCountQuantity) /
            (inventoryGood.dynamicSystemCount || 1)) *
          100,
        comments,
      };

      const totalDeviationPercent = inventoryGood.monthlyCounts.reduce(
        (acc, count) => acc + (count.deviationPercent || 0),
        0
      );

      const monthlyCountsWithDeviation = inventoryGood.monthlyCounts.filter(
        (count) => count.deviationPercent !== 0
      ).length;

      const averageDeviationPercentCalculation =
        (totalDeviationPercent + (newInventoryCount.deviationPercent ?? 0)) /
        (monthlyCountsWithDeviation + 1);

      await Promise.all([
        Inventory.updateOne(
          {
            _id: inventoryId,
            "inventoryGoods.supplierGoodId": supplierGoodId,
            "inventoryGoods.monthlyCounts.lastCount": true,
          },
          {
            $set: {
              "inventoryGoods.$[elem].monthlyCounts.$[count].lastCount": false,
            },
          },
          {
            arrayFilters: [
              { "elem.supplierGoodId": new Types.ObjectId(supplierGoodId) },
              { "count.lastCount": true },
            ],
          }
        ),

        Inventory.updateOne(
          {
            _id: inventoryId,
            "inventoryGoods.supplierGoodId": supplierGoodId,
          },
          {
            $set: {
              "inventoryGoods.$[elem].dynamicSystemCount": currentCountQuantity,
              "inventoryGoods.$[elem].averageDeviationPercent": averageDeviationPercentCalculation,
            },
            $push: {
              "inventoryGoods.$[elem].monthlyCounts": newInventoryCount,
            },
          },
          {
            arrayFilters: [{ "elem.supplierGoodId": new Types.ObjectId(supplierGoodId) }],
          }
        ),
      ]);

      return reply.code(200).send({ message: "Inventory count added!" });
    } catch (error) {
      return reply.code(500).send({
        message: "Updated inventory failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // PATCH /inventories/:inventoryId/supplierGood/:supplierGoodId/updateCount - update count
  app.patch("/:inventoryId/supplierGood/:supplierGoodId/updateCount", { preValidation: [createAuthHook(app)] }, async (req, reply) => {
    const params = req.params as { inventoryId?: string; supplierGoodId?: string };
    const { inventoryId, supplierGoodId } = params;

    if (!req.authSession) {
      return reply.code(401).send({ message: "Unauthorized" });
    }
    const userIdObj = new Types.ObjectId(req.authSession.id);

    const { currentCountQuantity, comments, countId, reason } = req.body as {
      countId?: string;
      reason?: string;
      currentCountQuantity?: number;
      comments?: string;
    };

    if (!inventoryId || !supplierGoodId || !countId || !reason) {
      return reply.code(400).send({
        message: "inventoryId, supplierGoodId, countId and reason are required for re-edit!",
      });
    }

    if (!isObjectIdValid([inventoryId, supplierGoodId, countId])) {
      return reply.code(400).send({ message: "One or more IDs are not valid!" });
    }

    try {
      const [inventory, supplierGood] = await Promise.all([
        Inventory.findOne({
          _id: inventoryId,
          "inventoryGoods.supplierGoodId": supplierGoodId,
        })
          .select("businessId setFinalCount inventoryGoods")
          .lean() as Promise<IInventory | null>,
        SupplierGood.findById(supplierGoodId)
          .select("parLevel")
          .lean() as Promise<ISupplierGood | null>,
      ]);

      if (!supplierGood || !inventory) {
        const message = !supplierGood ? "Supplier good not found!" : "Inventory not found!";
        return reply.code(400).send({ message });
      }

      const businessId = inventory.businessId as Types.ObjectId;
      const employee = (await Employee.findOne({
        userId: userIdObj,
        businessId,
      })
        .select("_id currentShiftRole")
        .lean()) as IEmployee | null;

      if (!employee || !MANAGEMENT_ROLES.includes(employee.currentShiftRole ?? "")) {
        return reply.code(403).send({
          message: "Only managers or supervisors can re-edit inventory counts!",
        });
      }

      if (inventory.setFinalCount) {
        return reply.code(400).send({
          message: "Inventory already set as final count! Cannot update!",
        });
      }

      const supplierGoodObject = inventory.inventoryGoods.find(
        (good) => good.supplierGoodId.toString() === supplierGoodId
      );

      if (!supplierGoodObject) {
        return reply.code(400).send({ message: "Supplier good not found in inventory!" });
      }

      const currentCountObject = supplierGoodObject.monthlyCounts.find(
        (count) => count._id && count._id.toString() === countId
      );

      if (!currentCountObject) {
        return reply.code(404).send({ message: "Count not found!" });
      }

      const newQuantity =
        currentCountQuantity !== undefined
          ? currentCountQuantity
          : currentCountObject.currentCountQuantity;

      if (
        currentCountQuantity !== undefined &&
        currentCountObject.currentCountQuantity === currentCountQuantity
      ) {
        return reply.code(200).send({ message: "Count is the same, no need to update!" });
      }

      let previewDynamicSystemCount = 0;
      if (currentCountObject.deviationPercent !== 100) {
        previewDynamicSystemCount =
          currentCountObject.currentCountQuantity /
          (1 - (currentCountObject.deviationPercent ?? 0) / 100);
      }

      const updateInventoryCount: IInventoryCount = {
        _id: new Types.ObjectId(countId),
        currentCountQuantity: newQuantity,
        quantityNeeded: (supplierGood.parLevel || 0) - newQuantity,
        countedByEmployeeId: currentCountObject.countedByEmployeeId,
        deviationPercent:
          ((previewDynamicSystemCount - newQuantity) /
            (previewDynamicSystemCount || 1)) *
          100,
        comments,
        reedited: {
          reeditedByEmployeeId: employee._id as Types.ObjectId,
          date: new Date(),
          reason,
          originalValues: {
            currentCountQuantity: currentCountObject.currentCountQuantity,
            deviationPercent: currentCountObject.deviationPercent ?? 0,
            dynamicSystemCount: previewDynamicSystemCount,
          },
        },
      };

      const totalDeviationPercent =
        supplierGoodObject.monthlyCounts.reduce(
          (acc: number, count: IInventoryCount) =>
            acc + (count.deviationPercent ?? 0),
          0
        ) -
        (currentCountObject.deviationPercent ?? 0) +
        (updateInventoryCount.deviationPercent ?? 0);

      const monthlyCountsWithDeviation = supplierGoodObject.monthlyCounts.filter(
        (count: IInventoryCount) => (count.deviationPercent ?? 0) !== 0
      ).length;

      const averageDeviationPercentCalculation =
        totalDeviationPercent / monthlyCountsWithDeviation;

      await Inventory.updateOne(
        {
          _id: inventoryId,
          "inventoryGoods.supplierGoodId": supplierGoodId,
          "inventoryGoods.monthlyCounts._id": countId,
        },
        {
          $set: {
            "inventoryGoods.$[supplierGood].dynamicSystemCount": newQuantity,
            "inventoryGoods.$[supplierGood].averageDeviationPercent":
              averageDeviationPercentCalculation,
            "inventoryGoods.$[supplierGood].monthlyCounts.$[count]":
              updateInventoryCount,
          },
        },
        {
          arrayFilters: [
            { "supplierGood.supplierGoodId": new Types.ObjectId(supplierGoodId) },
            { "count._id": new Types.ObjectId(countId) },
          ],
        }
      );

      return reply.code(200).send({ message: "Count updated successfully!" });
    } catch (error) {
      return reply.code(500).send({
        message: "Updating count failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // GET /inventories/business/:businessId - get by business
  app.get("/business/:businessId", async (req, reply) => {
    const params = req.params as { businessId?: string };
    const businessId = params.businessId;

    if (!businessId || isObjectIdValid([businessId]) !== true) {
      return reply.code(400).send({ message: "Business ID not valid!" });
    }

    const query = req.query as { monthDate?: string };
    const monthDateParams = query.monthDate;

    const startDate = monthDateParams ? new Date(monthDateParams) : null;
    let endDate = monthDateParams ? new Date(monthDateParams) : null;

    if (startDate) {
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    }

    if (endDate) {
      endDate = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
    }

    interface BusinessQuery {
      businessId: Types.ObjectId;
      createdAt?: { $gte: Date; $lte: Date };
    }

    const dbQuery: BusinessQuery = { businessId: new Types.ObjectId(businessId) };

    if (startDate && endDate) {
      dbQuery.createdAt = { $gte: startDate, $lte: endDate };
    }

    const inventories = await Inventory.find(dbQuery)
      .populate({
        path: "inventoryGoods.supplierGoodId",
        select:
          "name mainCategory subCategory supplierId budgetImpact imageUrl inventorySchedule parLevel measurementUnit pricePerMeasurementUnit",
        model: SupplierGood,
        populate: {
          path: "supplierId",
          select: "tradeName",
          model: Supplier,
        },
      })
      .lean();

    if (!inventories.length) {
      return reply.code(404).send({ message: "No inventories found!" });
    }
    return reply.code(200).send(inventories);
  });

  // GET /inventories/business/:businessId/lowStock - low stock report
  app.get("/business/:businessId/lowStock", async (req, reply) => {
    const params = req.params as { businessId?: string };
    const businessId = params.businessId;

    if (!businessId || isObjectIdValid([businessId]) !== true) {
      return reply.code(400).send({ message: "Business ID not valid!" });
    }

    try {
      interface InventoryWithGoods {
        inventoryGoods?: IInventory["inventoryGoods"];
      }

      const inventory = (await Inventory.findOne({
        businessId: new Types.ObjectId(businessId),
        setFinalCount: false,
      })
        .populate({
          path: "inventoryGoods.supplierGoodId",
          select:
            "name mainCategory subCategory measurementUnit parLevel minimumQuantityRequired",
          model: SupplierGood,
          populate: {
            path: "supplierId",
            select: "tradeName",
            model: Supplier,
          },
        })
        .lean()) as InventoryWithGoods | null;

      if (!inventory || !inventory.inventoryGoods?.length) {
        return reply.code(200).send({ lowStock: [] });
      }

      type PopulatedIg = {
        supplierGoodId: {
          _id?: Types.ObjectId;
          parLevel?: number;
          minimumQuantityRequired?: number;
          measurementUnit?: string;
        };
        dynamicSystemCount?: number;
      };

      const lowStock = inventory.inventoryGoods
        .filter((ig: IInventory["inventoryGoods"][0] | PopulatedIg) => {
          const sg = (ig as PopulatedIg).supplierGoodId;
          if (!sg) return false;
          const par = sg.parLevel ?? sg.minimumQuantityRequired;
          const min = sg.minimumQuantityRequired ?? sg.parLevel;
          const count = (ig as PopulatedIg).dynamicSystemCount ?? 0;
          if (par != null && count < par) return true;
          if (min != null && count < min) return true;
          return false;
        })
        .map((ig: IInventory["inventoryGoods"][0] | PopulatedIg) => {
          const pop = ig as PopulatedIg;
          return {
            supplierGoodId: pop.supplierGoodId?._id ?? pop.supplierGoodId,
            supplierGood: pop.supplierGoodId,
            dynamicSystemCount: pop.dynamicSystemCount,
            parLevel: pop.supplierGoodId?.parLevel,
            minimumQuantityRequired: pop.supplierGoodId?.minimumQuantityRequired,
            measurementUnit: pop.supplierGoodId?.measurementUnit,
          };
        });

      return reply.code(200).send({ lowStock });
    } catch (error) {
      return reply.code(500).send({
        message: "Get low stock failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // GET /inventories/business/:businessId/varianceReport - variance report
  app.get("/business/:businessId/varianceReport", async (req, reply) => {
    const params = req.params as { businessId?: string };
    const businessId = params.businessId;

    const query = req.query as { month?: string };
    const monthParam = query.month;

    if (!businessId || isObjectIdValid([businessId]) !== true) {
      return reply.code(400).send({ message: "Business ID is not valid!" });
    }

    let year: number;
    let month: number;
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [y, m] = monthParam.split("-").map(Number);
      if (m < 1 || m > 12) {
        return reply.code(400).send({ message: "Month must be 01-12." });
      }
      year = y;
      month = m;
    } else {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }

    try {
      const report = await getVarianceReport(new Types.ObjectId(businessId), year, month);

      const supplierGoodIds = report.map((r) => r.supplierGoodId);
      const supplierGoods = (await SupplierGood.find({
        _id: { $in: supplierGoodIds },
      })
        .select("name measurementUnit")
        .lean()) as { _id: Types.ObjectId; name?: string; measurementUnit?: string }[];

      const sgMap = new Map<
        string,
        { _id: Types.ObjectId; name?: string; measurementUnit?: string }
      >(
        supplierGoods.map((sg) => [sg._id.toString(), sg])
      );

      const payload = report.map((r) => ({
        ...r,
        supplierGoodName: sgMap.get(String(r.supplierGoodId))?.name,
      }));

      return reply.code(200).send({ varianceReport: payload });
    } catch (error) {
      return reply.code(500).send({
        message: "Variance report failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });
};

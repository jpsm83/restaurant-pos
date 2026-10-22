/**
 * Inventories Routes - Inventory CRUD and monthly count management.
 *
 * Every route declares its body/params/query as a strict zod DTO from
 * `backend/src/schemas/inventories.ts`; validation and sanitization happen at
 * the boundary and every error is raised as an `AppError` so the global handler
 * emits RFC 9457 `application/problem+json`. The management-role, business-match
 * and inventory-state guards span the database and stay as post-parse checks.
 */
import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type {
  IInventory,
  IInventoryCount,
} from "restaurant-pos-packages/interfaces/IInventory";
import type { ISupplierGood } from "restaurant-pos-packages/interfaces/ISupplierGood";
import type { IEmployee } from "restaurant-pos-packages/interfaces/IEmployee";

import Inventory from "../../models/inventory.ts";
import SupplierGood from "../../models/supplierGood.ts";
import Supplier from "../../models/supplier.ts";
import Employee from "../../models/employee.ts";
import { markAsDeletedById, withSoftDeleteFilter } from "../../models/softDelete.ts";
import createNextPeriodInventory from "../../inventories/createNextPeriodInventory.ts";
import getVarianceReport from "../../inventories/getVarianceReport.ts";
import { createAuthHook, createOptionalAuthHook } from "../../auth/middleware.ts";
import {
  badRequest,
  conflict,
  forbidden,
  internal,
  notFound,
  unauthorized,
} from "../../errors/appError.ts";
import {
  addInventoryCountBodySchema,
  businessIdParamsSchema,
  createInventoryBodySchema,
  inventoryIdParamsSchema,
  inventoryIncludeDeletedQuerySchema,
  inventoriesByBusinessQuerySchema,
  inventoryMonthDateQuerySchema,
  inventorySupplierGoodParamsSchema,
  updateInventoryCountBodySchema,
  varianceReportQuerySchema,
  type AddInventoryCountBody,
  type BusinessIdParams,
  type CreateInventoryBody,
  type InventoryIdParams,
  type InventoryIncludeDeletedQuery,
  type InventoriesByBusinessQuery,
  type InventoryMonthDateQuery,
  type InventorySupplierGoodParams,
  type UpdateInventoryCountBody,
  type VarianceReportQuery,
} from "../../schemas/inventories.ts";
import * as enums from "restaurant-pos-packages/enums";

const { managementRolesEnums } = enums;

const INVENTORY_POPULATE = {
  path: "inventoryGoods.supplierGoodId",
  select:
    "name mainCategory subCategory supplierId budgetImpact imageUrl inventorySchedule parLevel measurementUnit pricePerMeasurementUnit",
  model: SupplierGood,
  populate: {
    path: "supplierId",
    select: "tradeName",
    model: Supplier,
  },
};

/**
 * Compute the inclusive [start, end] range for a `monthDate` query value: the
 * first instant of the month through the last millisecond of its last day.
 */
const resolveMonthRange = (
  monthDate: Date | undefined,
): { startDate: Date; endDate: Date } | null => {
  if (!monthDate) return null;
  const startDate = new Date(monthDate);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0,
  );
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
};

export const inventoriesRoutes: FastifyPluginAsync = async (app) => {
  // GET /inventories - list all
  app.get<{ Querystring: InventoryIncludeDeletedQuery }>(
    "/",
    { schema: { querystring: inventoryIncludeDeletedQuerySchema } },
    async (req, reply) => {
      const { includeDeleted = false } = req.query;
      const inventories = await Inventory.find(
        withSoftDeleteFilter({}, includeDeleted),
      )
      .populate(INVENTORY_POPULATE)
      .lean();

      if (!inventories.length) {
        throw notFound("No inventories found");
      }
      return reply.code(200).send(inventories);
    },
  );

  // POST /inventories - create (transaction)
  app.post<{ Body: CreateInventoryBody }>(
    "/",
    { schema: { body: createInventoryBodySchema } },
    async (req, reply) => {
      const { businessId } = req.body;

      const startOfCurrentMonth = new Date();
      startOfCurrentMonth.setDate(1);
      startOfCurrentMonth.setHours(0, 0, 0, 0);

      const endOfCurrentMonth = new Date(startOfCurrentMonth);
      endOfCurrentMonth.setMonth(endOfCurrentMonth.getMonth() + 1);
      endOfCurrentMonth.setMilliseconds(-1);

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const currentMonthInventory: IInventory | null =
          await Inventory.findOne(
            withSoftDeleteFilter({
              businessId,
              createdAt: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth },
            }),
          )
            .select("setFinalCount")
            .session(session)
            .lean();

        if (currentMonthInventory) {
          throw badRequest("Inventory for the current month already exists!");
        }

        const startOfPreviousMonth = new Date(startOfCurrentMonth);
        startOfPreviousMonth.setMonth(startOfPreviousMonth.getMonth() - 1);

        const endOfPreviousMonth = new Date(startOfCurrentMonth);
        endOfPreviousMonth.setMilliseconds(-1);

        const lastInventory: IInventory | null =
          await Inventory.findOneAndUpdate(
            withSoftDeleteFilter({
              businessId,
              createdAt: {
                $gte: startOfPreviousMonth,
                $lte: endOfPreviousMonth,
              },
            }),
            {
              $set: { setFinalCount: true },
            },
            { returnDocument: "after", session },
          ).lean();

        const supplierGoods = await SupplierGood.find({
          businessId,
          currentlyInUse: true,
        })
          .select("_id")
          .session(session)
          .lean();

        const inventoryGoodsArr = supplierGoods.map(
          (supplierGood: { _id: Types.ObjectId }) => {
            const lastInventoryGood = lastInventory?.inventoryGoods.find(
              (good) =>
                good.supplierGoodId.toString() === supplierGood._id.toString(),
            );

            const dynamicSystemCount =
              lastInventoryGood && lastInventoryGood.monthlyCounts.length > 0
                ? lastInventoryGood.monthlyCounts.sort(
                    (a, b) =>
                      new Date(b.countedDate ?? "").getTime() -
                      new Date(a.countedDate ?? "").getTime(),
                  )[0]?.currentCountQuantity || 0
                : 0;

            return {
              supplierGoodId: supplierGood._id,
              monthlyCounts: [],
              dynamicSystemCount,
            };
          },
        );

        const newInventory: IInventory = {
          businessId: new Types.ObjectId(businessId),
          setFinalCount: false,
          inventoryGoods: inventoryGoodsArr,
        };

        const createdInventory = await Inventory.create([newInventory], {
          session,
        });

        if (!createdInventory) {
          throw internal("Failed to create inventory");
        }

        await session.commitTransaction();

        return reply
          .code(201)
          .send({ message: "Inventory created successfully" });
      } catch (error) {
        await session.abortTransaction().catch(() => undefined);
        throw error;
      } finally {
        session.endSession();
      }
    },
  );

  // GET /inventories/:inventoryId - get by ID
  app.get<{
    Params: InventoryIdParams;
    Querystring: InventoryIncludeDeletedQuery;
  }>(
    "/:inventoryId",
    {
      schema: {
        params: inventoryIdParamsSchema,
        querystring: inventoryIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { inventoryId } = req.params;
      const { includeDeleted = false } = req.query;

      const inventory = await Inventory.findOne(
        withSoftDeleteFilter({ _id: inventoryId }, includeDeleted),
      )
        .populate(INVENTORY_POPULATE)
        .lean();

      if (!inventory) {
        throw notFound("No inventory found");
      }
      return reply.code(200).send(inventory);
    },
  );

  // DELETE /inventories/:inventoryId - delete
  app.delete<{ Params: InventoryIdParams }>(
    "/:inventoryId",
    {
      preValidation: [createOptionalAuthHook(app)],
      schema: { params: inventoryIdParamsSchema },
    },
    async (req, reply) => {
      const { inventoryId } = req.params;
      const inventory = await Inventory.findById(inventoryId)
        .setOptions({ includeDeleted: true })
        .select("deleted")
        .lean();

      if (!inventory) {
        throw notFound("Inventory not found!");
      }
      if (inventory.deleted) {
        throw conflict("Inventory already deleted!");
      }

      const wasDeleted = await markAsDeletedById(
        Inventory as mongoose.Model<IInventory & { deleted: boolean }>,
        inventoryId,
        { deletedBy: req.authSession?.id },
      );
      if (!wasDeleted) {
        throw conflict("Inventory already deleted!");
      }

      return reply.code(200).send(`Inventory ${inventoryId} deleted`);
    },
  );

  // PATCH /inventories/:inventoryId/close - close inventory (transaction)
  app.patch<{ Params: InventoryIdParams }>(
    "/:inventoryId/close",
    {
      preValidation: [createAuthHook(app)],
      schema: { params: inventoryIdParamsSchema },
    },
    async (req, reply) => {
      const { inventoryId } = req.params;

      if (!req.authSession) {
        throw unauthorized();
      }
      const userIdObj = new Types.ObjectId(req.authSession.id);

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const inventory = (await Inventory.findOne(
          withSoftDeleteFilter({ _id: inventoryId }),
        )
          .select("businessId setFinalCount inventoryGoods")
          .lean()
          .session(session)) as IInventory | null;

        if (!inventory) {
          throw notFound("Inventory not found");
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
          throw forbidden("Employee not found for this business");
        }

        if (
          !managementRolesEnums.some(
            (role) => role === employee.currentShiftRole,
          )
        ) {
          throw forbidden("You are not allowed to close the inventory!");
        }

        if (employee.businessId?.toString() !== businessId.toString()) {
          throw forbidden("Inventory does not belong to your business");
        }

        if (inventory.setFinalCount) {
          throw badRequest("Inventory is already closed");
        }

        await Inventory.updateOne(
          withSoftDeleteFilter({ _id: inventoryId }),
          { $set: { setFinalCount: true } },
          { session },
        );

        await createNextPeriodInventory(
          businessId,
          inventory as IInventory,
          session,
        );

        await session.commitTransaction();

        return reply.code(200).send({
          message:
            "Inventory closed successfully and next period inventory created",
        });
      } catch (error) {
        await session.abortTransaction().catch(() => undefined);
        throw error;
      } finally {
        session.endSession();
      }
    },
  );

  // GET /inventories/:inventoryId/supplierGood/:supplierGoodId - get supplier good in inventory
  app.get<{
    Params: InventorySupplierGoodParams;
    Querystring: InventoryMonthDateQuery;
  }>(
    "/:inventoryId/supplierGood/:supplierGoodId",
    {
      schema: {
        params: inventorySupplierGoodParamsSchema,
        querystring: inventoryMonthDateQuerySchema,
      },
    },
    async (req, reply) => {
      const { inventoryId, supplierGoodId } = req.params;

      const range = resolveMonthRange(req.query.monthDate);

      interface InventoryQuery {
        _id: Types.ObjectId;
        "inventoryGoods.supplierGoodId": Types.ObjectId;
        createdAt?: { $gte: Date; $lte: Date };
      }

      const dbQuery: InventoryQuery = {
        _id: new Types.ObjectId(inventoryId),
        "inventoryGoods.supplierGoodId": new Types.ObjectId(supplierGoodId),
      };

      if (range) {
        dbQuery.createdAt = {
          $gte: range.startDate,
          $lte: range.endDate,
        };
      }

      const inventories = await Inventory.find(
        withSoftDeleteFilter(dbQuery as unknown as Record<string, unknown>),
      )
        .select("inventoryGoods.$")
        .populate(INVENTORY_POPULATE)
        .lean();

      if (!inventories.length) {
        throw notFound("No inventories found!");
      }
      return reply.code(200).send(inventories);
    },
  );

  // PATCH /inventories/:inventoryId/supplierGood/:supplierGoodId/addCount - add count
  app.patch<{ Params: InventorySupplierGoodParams; Body: AddInventoryCountBody }>(
    "/:inventoryId/supplierGood/:supplierGoodId/addCount",
    {
      schema: {
        params: inventorySupplierGoodParamsSchema,
        body: addInventoryCountBodySchema,
      },
    },
    async (req, reply) => {
      const { inventoryId, supplierGoodId } = req.params;
      const { currentCountQuantity, countedByEmployeeId, comments } = req.body;

      const [inventory, supplierGood] = await Promise.all([
        Inventory.findOne({
          ...withSoftDeleteFilter({
            _id: inventoryId,
            "inventoryGoods.supplierGoodId": supplierGoodId,
          }),
        })
          .select("setFinalCount inventoryGoods.$")
          .lean() as Promise<IInventory | null>,
        SupplierGood.findById(supplierGoodId)
          .select("parLevel")
          .lean() as Promise<ISupplierGood | null>,
      ]);

      if (!supplierGood || !inventory) {
        throw badRequest(
          !supplierGood ? "Supplier good not found!" : "Inventory not found!",
        );
      }

      if (inventory.setFinalCount) {
        throw badRequest(
          "Inventory already set as final count! Cannot update!",
        );
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
        countedByEmployeeId: new Types.ObjectId(countedByEmployeeId),
        deviationPercent:
          ((inventoryGood.dynamicSystemCount - currentCountQuantity) /
            (inventoryGood.dynamicSystemCount || 1)) *
          100,
        comments,
      };

      const totalDeviationPercent = inventoryGood.monthlyCounts.reduce(
        (acc, count) => acc + (count.deviationPercent || 0),
        0,
      );

      const monthlyCountsWithDeviation = inventoryGood.monthlyCounts.filter(
        (count) => count.deviationPercent !== 0,
      ).length;

      const averageDeviationPercentCalculation =
        (totalDeviationPercent + (newInventoryCount.deviationPercent ?? 0)) /
        (monthlyCountsWithDeviation + 1);

      await Promise.all([
        Inventory.updateOne(
          {
            ...withSoftDeleteFilter({ _id: inventoryId }),
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
          },
        ),

        Inventory.updateOne(
          {
            ...withSoftDeleteFilter({ _id: inventoryId }),
            "inventoryGoods.supplierGoodId": supplierGoodId,
          },
          {
            $set: {
              "inventoryGoods.$[elem].dynamicSystemCount": currentCountQuantity,
              "inventoryGoods.$[elem].averageDeviationPercent":
                averageDeviationPercentCalculation,
            },
            $push: {
              "inventoryGoods.$[elem].monthlyCounts": newInventoryCount,
            },
          },
          {
            arrayFilters: [
              { "elem.supplierGoodId": new Types.ObjectId(supplierGoodId) },
            ],
          },
        ),
      ]);

      return reply.code(200).send({ message: "Inventory count added!" });
    },
  );

  // PATCH /inventories/:inventoryId/supplierGood/:supplierGoodId/updateCount - update count
  app.patch<{
    Params: InventorySupplierGoodParams;
    Body: UpdateInventoryCountBody;
  }>(
    "/:inventoryId/supplierGood/:supplierGoodId/updateCount",
    {
      preValidation: [createAuthHook(app)],
      schema: {
        params: inventorySupplierGoodParamsSchema,
        body: updateInventoryCountBodySchema,
      },
    },
    async (req, reply) => {
      const { inventoryId, supplierGoodId } = req.params;

      if (!req.authSession) {
        throw unauthorized();
      }
      const userIdObj = new Types.ObjectId(req.authSession.id);

      const { currentCountQuantity, comments, countId, reason } = req.body;

      const [inventory, supplierGood] = await Promise.all([
        Inventory.findOne({
          ...withSoftDeleteFilter({
            _id: inventoryId,
            "inventoryGoods.supplierGoodId": supplierGoodId,
          }),
        })
          .select("businessId setFinalCount inventoryGoods")
          .lean() as Promise<IInventory | null>,
        SupplierGood.findById(supplierGoodId)
          .select("parLevel")
          .lean() as Promise<ISupplierGood | null>,
      ]);

      if (!supplierGood || !inventory) {
        throw badRequest(
          !supplierGood ? "Supplier good not found!" : "Inventory not found!",
        );
      }

      const businessId = inventory.businessId as Types.ObjectId;
      const employee = (await Employee.findOne({
        userId: userIdObj,
        businessId,
      })
        .select("_id currentShiftRole")
        .lean()) as IEmployee | null;

      if (
        !employee ||
        !managementRolesEnums.some(
          (role) => role === employee.currentShiftRole,
        )
      ) {
        throw forbidden(
          "Only managers or supervisors can re-edit inventory counts!",
        );
      }

      if (inventory.setFinalCount) {
        throw badRequest(
          "Inventory already set as final count! Cannot update!",
        );
      }

      const supplierGoodObject = inventory.inventoryGoods.find(
        (good) => good.supplierGoodId.toString() === supplierGoodId,
      );

      if (!supplierGoodObject) {
        throw badRequest("Supplier good not found in inventory!");
      }

      const currentCountObject = supplierGoodObject.monthlyCounts.find(
        (count) => count._id && count._id.toString() === countId,
      );

      if (!currentCountObject) {
        throw notFound("Count not found!");
      }

      const newQuantity =
        currentCountQuantity !== undefined
          ? currentCountQuantity
          : currentCountObject.currentCountQuantity;

      if (
        currentCountQuantity !== undefined &&
        currentCountObject.currentCountQuantity === currentCountQuantity
      ) {
        return reply
          .code(200)
          .send({ message: "Count is the same, no need to update!" });
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
          0,
        ) -
        (currentCountObject.deviationPercent ?? 0) +
        (updateInventoryCount.deviationPercent ?? 0);

      const monthlyCountsWithDeviation = supplierGoodObject.monthlyCounts.filter(
        (count: IInventoryCount) => (count.deviationPercent ?? 0) !== 0,
      ).length;

      const averageDeviationPercentCalculation =
        totalDeviationPercent / monthlyCountsWithDeviation;

      await Inventory.updateOne(
        {
          ...withSoftDeleteFilter({ _id: inventoryId }),
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
            {
              "supplierGood.supplierGoodId": new Types.ObjectId(supplierGoodId),
            },
            { "count._id": new Types.ObjectId(countId) },
          ],
        },
      );

      return reply.code(200).send({ message: "Count updated successfully!" });
    },
  );

  // GET /inventories/business/:businessId - get by business
  app.get<{ Params: BusinessIdParams; Querystring: InventoriesByBusinessQuery }>(
    "/business/:businessId",
    {
      schema: {
        params: businessIdParamsSchema,
        querystring: inventoriesByBusinessQuerySchema,
      },
    },
    async (req, reply) => {
      const { businessId } = req.params;
      const { includeDeleted = false } = req.query;

      const range = resolveMonthRange(req.query.monthDate);

      interface BusinessQuery {
        businessId: Types.ObjectId;
        createdAt?: { $gte: Date; $lte: Date };
      }

      const dbQuery: BusinessQuery = {
        businessId: new Types.ObjectId(businessId),
      };

      if (range) {
        dbQuery.createdAt = {
          $gte: range.startDate,
          $lte: range.endDate,
        };
      }

      const inventories = await Inventory.find(
        withSoftDeleteFilter(
          dbQuery as unknown as Record<string, unknown>,
          includeDeleted,
        ),
      )
        .populate(INVENTORY_POPULATE)
        .lean();

      if (!inventories.length) {
        throw notFound("No inventories found!");
      }
      return reply.code(200).send(inventories);
    },
  );

  // GET /inventories/business/:businessId/lowStock - low stock report
  app.get<{ Params: BusinessIdParams }>(
    "/business/:businessId/lowStock",
    { schema: { params: businessIdParamsSchema } },
    async (req, reply) => {
      const { businessId } = req.params;

      interface InventoryWithGoods {
        inventoryGoods?: IInventory["inventoryGoods"];
      }

      const inventory = (await Inventory.findOne({
        ...withSoftDeleteFilter({
          businessId: new Types.ObjectId(businessId),
          setFinalCount: false,
        }),
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
            minimumQuantityRequired:
              pop.supplierGoodId?.minimumQuantityRequired,
            measurementUnit: pop.supplierGoodId?.measurementUnit,
          };
        });

      return reply.code(200).send({ lowStock });
    },
  );

  // GET /inventories/business/:businessId/varianceReport - variance report
  app.get<{ Params: BusinessIdParams; Querystring: VarianceReportQuery }>(
    "/business/:businessId/varianceReport",
    {
      schema: {
        params: businessIdParamsSchema,
        querystring: varianceReportQuerySchema,
      },
    },
    async (req, reply) => {
      const { businessId } = req.params;
      const { month: monthParam } = req.query;

      const now = new Date();
      const year = monthParam?.year ?? now.getFullYear();
      const month = monthParam?.month ?? now.getMonth() + 1;

      const report = await getVarianceReport(
        new Types.ObjectId(businessId),
        year,
        month,
      );

      const supplierGoodIds = report.map((r) => r.supplierGoodId);
      const supplierGoods = (await SupplierGood.find({
        _id: { $in: supplierGoodIds },
      })
        .select("name measurementUnit")
        .lean()) as {
        _id: Types.ObjectId;
        name?: string;
        measurementUnit?: string;
      }[];

      const sgMap = new Map<
        string,
        { _id: Types.ObjectId; name?: string; measurementUnit?: string }
      >(supplierGoods.map((sg) => [sg._id.toString(), sg]));

      const payload = report.map((r) => ({
        ...r,
        supplierGoodName: sgMap.get(String(r.supplierGoodId))?.name,
      }));

      return reply.code(200).send({ varianceReport: payload });
    },
  );
};

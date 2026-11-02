/**
 * Purchases Routes — purchase reads and per-supplier / per-user listings.
 *
 * The unsafe legacy mutations are retired until the purchases build-order row
 * lands; every route here still requires a live User session at the v1 gate.
 */
import type { FastifyPluginAsync } from "fastify";
import { Types } from "mongoose";

import Purchase from "../../models/purchase.ts";
import Supplier from "../../models/supplier.ts";
import SupplierGood from "../../models/supplierGood.ts";
import Employee from "../../models/employee.ts";
import { withSoftDeleteFilter } from "../../models/softDelete.ts";
import { badRequest, notFound } from "../../errors/appError.ts";
import {
  purchaseBySupplierParamsSchema,
  purchaseByUserParamsSchema,
  purchaseIdParamsSchema,
  purchasesQuerySchema,
  type PurchaseBySupplierParams,
  type PurchaseByUserParams,
  type PurchaseIdParams,
  type PurchasesQuery,
} from "restaurant-pos-packages/schemas/purchase";

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
      const { includeDeleted = false } = req.query;

      const dbQuery: { purchaseDate?: { $gte: Date; $lte: Date } } = {};

      const purchaseDate = purchaseDateFilter(startDate, endDate);
      if (purchaseDate) {
        dbQuery.purchaseDate = purchaseDate;
      }

      const purchases = await Purchase.find(
        withSoftDeleteFilter(
          dbQuery as unknown as Record<string, unknown>,
          includeDeleted,
        ),
      )
        .populate(SUPPLIER_POPULATE)
        .populate(PURCHASE_ITEMS_POPULATE)
        .lean();

      if (!purchases?.length) {
        throw notFound("No purchases found");
      }
      return reply.code(200).send(purchases);
    },
  );

  // GET /purchases/:purchaseId - get by ID
  app.get<{ Params: PurchaseIdParams; Querystring: PurchasesQuery }>(
    "/:purchaseId",
    {
      schema: {
        params: purchaseIdParamsSchema,
        querystring: purchasesQuerySchema,
      },
    },
    async (req, reply) => {
      const { purchaseId } = req.params;
      const { includeDeleted = false } = req.query;

      const purchase = await Purchase.findOne(
        withSoftDeleteFilter({ _id: purchaseId }, includeDeleted),
      )
        .populate(SUPPLIER_POPULATE)
        .populate(PURCHASE_ITEMS_POPULATE)
        .lean();

      if (!purchase) {
        throw notFound("Purchase not found!");
      }
      return reply.code(200).send(purchase);
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
      const { startDate, endDate, includeDeleted = false } = req.query;

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

      const purchase = await Purchase.find(
        withSoftDeleteFilter(
          dbQuery as unknown as Record<string, unknown>,
          includeDeleted,
        ),
      )
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
      const { startDate, endDate, includeDeleted = false } = req.query;

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

      const purchase = await Purchase.find(
        withSoftDeleteFilter(
          dbQuery as unknown as Record<string, unknown>,
          includeDeleted,
        ),
      )
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

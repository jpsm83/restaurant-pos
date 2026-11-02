/**
 * SupplierGoods Routes — supplier good reads and per-supplier listings.
 *
 * The unsafe legacy mutations are retired until the supplier-goods build-order
 * row lands; every route here still requires a live User session at the v1
 * gate.
 */
import type { FastifyPluginAsync } from "fastify";

import SupplierGood from "../../models/supplierGood.ts";
import Supplier from "../../models/supplier.ts";
import { notFound } from "../../errors/appError.ts";
import { withSoftDeleteFilter } from "../../models/softDelete.ts";
import {
  supplierGoodBySupplierParamsSchema,
  supplierGoodsIncludeDeletedQuerySchema,
  supplierGoodIdParamsSchema,
  type SupplierGoodBySupplierParams,
  type SupplierGoodsIncludeDeletedQuery,
  type SupplierGoodIdParams,
} from "restaurant-pos-packages/schemas/supplierGood";

const SUPPLIER_POPULATE = {
  path: "supplierId",
  select: "tradeName",
  model: Supplier,
};

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

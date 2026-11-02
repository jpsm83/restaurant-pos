/**
 * BusinessGoods Routes — business good reads and listings.
 *
 * The unsafe legacy mutations are retired until the business-goods build-order
 * row lands; every route here still requires a live User session at the v1
 * gate.
 */
import type { FastifyPluginAsync } from "fastify";

import BusinessGood from "../../models/businessGood.ts";
import SupplierGood from "../../models/supplierGood.ts";
import { notFound } from "../../errors/appError.ts";
import { withSoftDeleteFilter } from "../../models/softDelete.ts";
import {
  businessGoodByBusinessParamsSchema,
  businessGoodIdParamsSchema,
  businessGoodsIncludeDeletedQuerySchema,
  type BusinessGoodByBusinessParams,
  type BusinessGoodsIncludeDeletedQuery,
  type BusinessGoodIdParams,
} from "restaurant-pos-packages/schemas/businessGood";

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

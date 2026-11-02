/**
 * Promotions Routes — promotion reads and per-business listings.
 *
 * The unsafe legacy mutations are retired until the promotions build-order row
 * lands; every route here still requires a live User session at the v1 gate.
 */
import type { FastifyPluginAsync } from "fastify";
import { Types } from "mongoose";

import Promotion from "../../models/promotion.ts";
import BusinessGood from "../../models/businessGood.ts";
import { withSoftDeleteFilter } from "../../models/softDelete.ts";
import { badRequest, notFound } from "../../errors/appError.ts";
import {
  promotionsIncludeDeletedQuerySchema,
  promotionIdParamsSchema,
  promotionsByBusinessParamsSchema,
  promotionsByBusinessQuerySchema,
  type PromotionsIncludeDeletedQuery,
  type PromotionIdParams,
  type PromotionsByBusinessParams,
  type PromotionsByBusinessQuery,
} from "restaurant-pos-packages/schemas/promotions";

const BUSINESS_GOODS_POPULATE = {
  path: "businessGoodsToApplyIds",
  select: "name",
  model: BusinessGood,
};

export const promotionsRoutes: FastifyPluginAsync = async (app) => {
  // GET /promotions - list all
  app.get<{ Querystring: PromotionsIncludeDeletedQuery }>(
    "/",
    { schema: { querystring: promotionsIncludeDeletedQuerySchema } },
    async (req, reply) => {
      const { includeDeleted = false } = req.query;
      const promotions = await Promotion.find(
        withSoftDeleteFilter({}, includeDeleted),
      )
        .populate(BUSINESS_GOODS_POPULATE)
        .lean();

      if (!promotions.length) {
        throw notFound("No promotions found!");
      }
      return reply.code(200).send(promotions);
    },
  );

  // GET /promotions/:promotionId - get by ID
  app.get<{
    Params: PromotionIdParams;
    Querystring: PromotionsIncludeDeletedQuery;
  }>(
    "/:promotionId",
    {
      schema: {
        params: promotionIdParamsSchema,
        querystring: promotionsIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { promotionId } = req.params;
      const { includeDeleted = false } = req.query;

      const promotion = await Promotion.findOne(
        withSoftDeleteFilter({ _id: promotionId }, includeDeleted),
      )
        .populate(BUSINESS_GOODS_POPULATE)
        .lean();

      if (!promotion) {
        throw notFound("Promotion not found!");
      }
      return reply.code(200).send(promotion);
    },
  );

  // GET /promotions/business/:businessId - get by business
  app.get<{
    Params: PromotionsByBusinessParams;
    Querystring: PromotionsByBusinessQuery;
  }>(
    "/business/:businessId",
    {
      schema: {
        params: promotionsByBusinessParamsSchema,
        querystring: promotionsByBusinessQuerySchema,
      },
    },
    async (req, reply) => {
      const { businessId } = req.params;
      const { startDate, endDate, includeDeleted = false } = req.query;

      const filter: {
        businessId: Types.ObjectId;
        "promotionPeriod.start"?: { $gte: Date };
        "promotionPeriod.end"?: { $lte: Date };
      } = { businessId: new Types.ObjectId(businessId) };

      if (startDate && endDate) {
        if (startDate > endDate) {
          throw badRequest(
            "Invalid date range, start date must be before end date!",
          );
        }
        filter["promotionPeriod.start"] = { $gte: startDate };
        filter["promotionPeriod.end"] = { $lte: endDate };
      }

      const promotions = await Promotion.find(
        withSoftDeleteFilter(filter, includeDeleted),
      )
        .populate(BUSINESS_GOODS_POPULATE)
        .lean();

      if (!promotions.length) {
        throw notFound("No promotion found!");
      }
      return reply.code(200).send(promotions);
    },
  );
};

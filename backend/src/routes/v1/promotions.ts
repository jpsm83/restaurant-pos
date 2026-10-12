/**
 * Promotions Routes - Promotion CRUD and listing.
 *
 * Every route declares its body/params/query as a strict zod DTO from
 * `packages/schemas/promotions.ts`; validation and sanitization happen at the
 * boundary and every error is raised as an `AppError` so the global handler
 * emits RFC 9457 `application/problem+json`. `validateDateAndTime`,
 * `validateDaysOfTheWeek` and `validatePromotionType` stay as named post-parse
 * checks, alongside the query date-range check and the database-backed
 * duplicate-name rule.
 */
import type { FastifyPluginAsync } from "fastify";
import { Types } from "mongoose";
import type { IPromotion } from "restaurant-pos-packages/interfaces/IPromotion";
import type { PromotionType } from "restaurant-pos-packages/interfaces/IPromotion";

import validateDateAndTime from "../../promotions/validateDateAndTime.ts";
import validateDaysOfTheWeek from "../../promotions/validateDaysOfTheWeek.ts";
import validatePromotionType from "../../promotions/validatePromotionType.ts";
import Promotion from "../../models/promotion.ts";
import BusinessGood from "../../models/businessGood.ts";
import { badRequest, conflict, notFound } from "../../errors/appError.ts";
import {
  createPromotionBodySchema,
  promotionIdParamsSchema,
  promotionsByBusinessParamsSchema,
  promotionsByBusinessQuerySchema,
  updatePromotionBodySchema,
  type CreatePromotionBody,
  type PromotionIdParams,
  type PromotionsByBusinessParams,
  type PromotionsByBusinessQuery,
  type UpdatePromotionBody,
} from "restaurant-pos-packages/schemas/promotions";

const BUSINESS_GOODS_POPULATE = {
  path: "businessGoodsToApplyIds",
  select: "name",
  model: BusinessGood,
};

export const promotionsRoutes: FastifyPluginAsync = async (app) => {
  // GET /promotions - list all
  app.get("/", async (_req, reply) => {
    const promotions = await Promotion.find()
      .populate(BUSINESS_GOODS_POPULATE)
      .lean();

    if (!promotions.length) {
      throw notFound("No promotions found!");
    }
    return reply.code(200).send(promotions);
  });

  // POST /promotions - create
  app.post<{ Body: CreatePromotionBody }>(
    "/",
    { schema: { body: createPromotionBodySchema } },
    async (req, reply) => {
      const {
        promotionName,
        promotionPeriod,
        weekDays,
        activePromotion,
        promotionType,
        businessId,
        businessGoodsToApplyIds,
        applyToDelivery,
        description,
      } = req.body;

      const dateAndTimeResult = validateDateAndTime(promotionPeriod);

      if (dateAndTimeResult !== true) {
        throw badRequest(dateAndTimeResult);
      }

      const weekDaysResult = validateDaysOfTheWeek(weekDays);

      if (weekDaysResult !== true) {
        throw badRequest(weekDaysResult);
      }

      const promotionTypeResult = validatePromotionType(
        promotionType as PromotionType,
      );
      if (promotionTypeResult !== true) {
        throw badRequest(promotionTypeResult);
      }

      const businessObjectId = new Types.ObjectId(businessId);

      const duplicatePromotion = await Promotion.exists({
        businessId: businessObjectId,
        promotionName,
      });

      if (duplicatePromotion) {
        throw conflict(`Promotion ${promotionName} already exists!`);
      }

      await Promotion.create({
        promotionName,
        promotionPeriod,
        weekDays,
        activePromotion,
        promotionType,
        businessId: businessObjectId,
        businessGoodsToApplyIds: businessGoodsToApplyIds || undefined,
        applyToDelivery: applyToDelivery ?? undefined,
        description: description || undefined,
      });

      return reply.code(201).send({
        message: `Promotion ${promotionName} created successfully!`,
      });
    },
  );

  // GET /promotions/:promotionId - get by ID
  app.get<{ Params: PromotionIdParams }>(
    "/:promotionId",
    { schema: { params: promotionIdParamsSchema } },
    async (req, reply) => {
      const { promotionId } = req.params;

      const promotion = await Promotion.findById(promotionId)
        .populate(BUSINESS_GOODS_POPULATE)
        .lean();

      if (!promotion) {
        throw notFound("Promotion not found!");
      }
      return reply.code(200).send(promotion);
    },
  );

  // PATCH /promotions/:promotionId - update
  app.patch<{ Params: PromotionIdParams; Body: UpdatePromotionBody }>(
    "/:promotionId",
    {
      schema: {
        params: promotionIdParamsSchema,
        body: updatePromotionBodySchema,
      },
    },
    async (req, reply) => {
      const { promotionId } = req.params;
      const {
        promotionName,
        promotionPeriod,
        weekDays,
        activePromotion,
        promotionType,
        businessGoodsToApplyIds,
        applyToDelivery,
        description,
      } = req.body;

      if (promotionPeriod) {
        const dateAndTimeResult = validateDateAndTime(promotionPeriod);

        if (dateAndTimeResult !== true) {
          throw badRequest(dateAndTimeResult);
        }
      }

      if (weekDays) {
        const weekDaysResult = validateDaysOfTheWeek(weekDays);

        if (weekDaysResult !== true) {
          throw badRequest(weekDaysResult);
        }
      }

      if (promotionType) {
        const promotionTypeResult = validatePromotionType(
          promotionType as PromotionType,
        );
        if (promotionTypeResult !== true) {
          throw badRequest(promotionTypeResult);
        }
      }

      const promotion = (await Promotion.findById(promotionId)
        .select("businessId")
        .lean()) as unknown as IPromotion | null;

      if (!promotion) {
        throw notFound("Promotion not found!");
      }

      if (promotionName) {
        const duplicatePromotion = await Promotion.exists({
          _id: { $ne: promotionId },
          businessId: promotion.businessId,
          promotionName,
        });

        if (duplicatePromotion) {
          throw conflict(`Promotion ${promotionName} already exists!`);
        }
      }

      const updatedPromotion: Partial<IPromotion> = {};

      if (promotionName) updatedPromotion.promotionName = promotionName;
      if (promotionPeriod) updatedPromotion.promotionPeriod = promotionPeriod;
      if (weekDays) updatedPromotion.weekDays = weekDays;
      if (activePromotion) updatedPromotion.activePromotion = activePromotion;
      if (promotionType) updatedPromotion.promotionType = promotionType;
      if (businessGoodsToApplyIds)
        updatedPromotion.businessGoodsToApplyIds =
          businessGoodsToApplyIds.map((id) => new Types.ObjectId(id));
      if (applyToDelivery !== undefined)
        updatedPromotion.applyToDelivery = applyToDelivery;
      if (description) updatedPromotion.description = description;

      await Promotion.updateOne(
        { _id: promotionId },
        { $set: updatedPromotion },
      );

      return reply.code(200).send({
        message: "Promotion updated successfully!",
      });
    },
  );

  // DELETE /promotions/:promotionId - delete
  app.delete<{ Params: PromotionIdParams }>(
    "/:promotionId",
    { schema: { params: promotionIdParamsSchema } },
    async (req, reply) => {
      const { promotionId } = req.params;

      const result = await Promotion.deleteOne({ _id: promotionId });

      if (result.deletedCount === 0) {
        throw notFound("Promotion not found!");
      }

      return reply
        .code(200)
        .send({ message: `Promotion ${promotionId} deleted!` });
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
      const { startDate, endDate } = req.query;

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

      const promotions = await Promotion.find(filter)
        .populate(BUSINESS_GOODS_POPULATE)
        .lean();

      if (!promotions.length) {
        throw notFound("No promotion found!");
      }
      return reply.code(200).send(promotions);
    },
  );
};

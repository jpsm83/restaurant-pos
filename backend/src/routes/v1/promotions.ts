import type { FastifyPluginAsync } from "fastify";
import { Types } from "mongoose";
import type { IPromotion } from "../../../../lib/interface/IPromotion.ts";

import isObjectIdValid from "../../utils/isObjectIdValid.ts";
import validateDateAndTime from "../../promotions/validateDateAndTime.ts";
import validateDaysOfTheWeek from "../../promotions/validateDaysOfTheWeek.ts";
import validatePromotionType from "../../promotions/validatePromotionType.ts";
import Promotion from "../../models/promotion.ts";
import BusinessGood from "../../models/businessGood.ts";

export const promotionsRoutes: FastifyPluginAsync = async (app) => {
  // GET /promotions - list all
  app.get("/", async (_req, reply) => {
    try {
      const promotion = await Promotion.find()
        .populate({
          path: "businessGoodsToApplyIds",
          select: "name",
          model: BusinessGood,
        })
        .lean();

      if (!promotion.length) {
        return reply.code(404).send({ message: "No promotion  found!" });
      }
      return reply.code(200).send(promotion);
    } catch (error) {
      return reply.code(500).send({
        message: "Get all promotions failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // POST /promotions - create
  app.post("/", async (req, reply) => {
    try {
      const {
        promotionName,
        promotionPeriod,
        weekDays,
        activePromotion,
        promotionType,
        businessId,
        businessGoodsToApplyIds,
        description,
      } = req.body as IPromotion;

      if (
        !promotionName ||
        !promotionPeriod ||
        !weekDays ||
        activePromotion === undefined ||
        !promotionType ||
        !businessId
      ) {
        return reply.code(400).send({
          message:
            "PromotionName, promotionPeriod, weekDays, activePromotion, promotionType and business are required fields!",
        });
      }

      if (businessGoodsToApplyIds) {
        if (!Array.isArray(businessGoodsToApplyIds)) {
          return reply.code(400).send({
            message:
              "BusinessGoodsToApply should be an array of business goods IDs!",
          });
        }

        for (const businessGoodId of businessGoodsToApplyIds) {
          if (isObjectIdValid([businessGoodId]) !== true) {
            return reply.code(400).send({
              message: "BusinessGoodsToApply IDs not valid!",
            });
          }
        }
      }

      const validateDateAndTimeResult = validateDateAndTime(promotionPeriod);

      if (validateDateAndTimeResult !== true) {
        return reply.code(400).send({ message: validateDateAndTimeResult });
      }

      const validateDaysOfTheWeekResult = validateDaysOfTheWeek(weekDays);

      if (validateDaysOfTheWeekResult !== true) {
        return reply.code(400).send({ message: validateDaysOfTheWeekResult });
      }

      const validatePromotionTypeResult = validatePromotionType(promotionType);
      if (validatePromotionTypeResult !== true) {
        return reply.code(400).send({ message: validatePromotionTypeResult });
      }

      const duplicatePromotion = await Promotion.exists({
        businessId,
        promotionName,
      });

      if (duplicatePromotion) {
        return reply.code(400).send({
          message: `Promotion ${promotionName} already exists!`,
        });
      }

      const newPromotion = {
        promotionName,
        promotionPeriod,
        weekDays,
        activePromotion,
        promotionType,
        businessId,
        businessGoodsToApply: businessGoodsToApplyIds || undefined,
        description: description || undefined,
      };

      await Promotion.create(newPromotion);

      return reply.code(201).send({
        message: `Promotion ${promotionName} created successfully!`,
      });
    } catch (error) {
      return reply.code(500).send({
        message: "Create promotion failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // GET /promotions/:promotionId - get by ID
  app.get("/:promotionId", async (req, reply) => {
    try {
      const params = req.params as { promotionId?: string };
      const promotionId = params.promotionId;

      if (!promotionId || isObjectIdValid([promotionId]) !== true) {
        return reply.code(400).send({ message: "Invalid promotionId!" });
      }

      const promotion = await Promotion.findById(promotionId)
        .populate({
          path: "businessGoodsToApplyIds",
          select: "name",
          model: BusinessGood,
        })
        .lean();

      if (!promotion) {
        return reply.code(404).send({ message: "Promotion  not found!" });
      }
      return reply.code(200).send(promotion);
    } catch (error) {
      return reply.code(500).send({
        message: "Get promotion by its id failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // PATCH /promotions/:promotionId - update
  app.patch("/:promotionId", async (req, reply) => {
    try {
      const params = req.params as { promotionId?: string };
      const promotionId = params.promotionId;

      if (!promotionId || isObjectIdValid([promotionId]) !== true) {
        return reply.code(400).send({ message: "Invalid promotionId!" });
      }

      const {
        promotionName,
        promotionPeriod,
        weekDays,
        activePromotion,
        promotionType,
        businessGoodsToApplyIds,
        description,
      } = req.body as IPromotion;

      if (businessGoodsToApplyIds) {
        if (!Array.isArray(businessGoodsToApplyIds)) {
          return reply.code(400).send({
            message:
              "BusinessGoodsToApply should be an array of business goods IDs!",
          });
        }

        for (const businessGoodId of businessGoodsToApplyIds) {
          if (isObjectIdValid([businessGoodId]) !== true) {
            return reply.code(400).send({
              message: "BusinessGoodsToApply IDs not valid!",
            });
          }
        }
      }

      if (promotionPeriod) {
        const validateDateAndTimeResult = validateDateAndTime(promotionPeriod);

        if (validateDateAndTimeResult !== true) {
          return reply.code(400).send({ message: validateDateAndTimeResult });
        }
      }

      if (weekDays) {
        const validateDaysOfTheWeekResult = validateDaysOfTheWeek(weekDays);

        if (validateDaysOfTheWeekResult !== true) {
          return reply.code(400).send({ message: validateDaysOfTheWeekResult });
        }
      }

      if (promotionType) {
        const validatePromotionTypeResult =
          validatePromotionType(promotionType);
        if (validatePromotionTypeResult !== true) {
          return reply.code(400).send({ message: validatePromotionTypeResult });
        }
      }

      const promotion = (await Promotion.findById(promotionId)
        .select("businessId")
        .lean()) as unknown as IPromotion | null;

      if (!promotion) {
        return reply.code(404).send({ message: "Promotion not found!" });
      }

      const duplicatePromotion = await Promotion.exists({
        _id: { $ne: promotionId },
        businessId: promotion.businessId,
        promotionName,
      });

      if (duplicatePromotion) {
        return reply.code(400).send({
          message: `Promotion ${promotionName} already exists!`,
        });
      }

      const updatedPromotion: Partial<IPromotion> = {};

      if (promotionName) updatedPromotion.promotionName = promotionName;
      if (promotionPeriod) updatedPromotion.promotionPeriod = promotionPeriod;
      if (weekDays) updatedPromotion.weekDays = weekDays;
      if (activePromotion) updatedPromotion.activePromotion = activePromotion;
      if (promotionType) updatedPromotion.promotionType = promotionType;
      if (businessGoodsToApplyIds)
        updatedPromotion.businessGoodsToApplyIds = businessGoodsToApplyIds;
      if (description) updatedPromotion.description = description;

      await Promotion.updateOne(
        { _id: promotionId },
        { $set: updatedPromotion },
      );

      return reply.code(200).send({
        message: "Promotion updated successfully!",
      });
    } catch (error) {
      return reply.code(500).send({
        message: "Update promotion failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // DELETE /promotions/:promotionId - delete
  app.delete("/:promotionId", async (req, reply) => {
    try {
      const params = req.params as { promotionId?: string };
      const promotionId = params.promotionId;

      if (!promotionId || isObjectIdValid([promotionId]) !== true) {
        return reply.code(400).send({ message: "Invalid promotionId!" });
      }

      const result = await Promotion.deleteOne({ _id: promotionId });

      if (result.deletedCount === 0) {
        return reply.code(404).send({ message: "Promotion not found!" });
      }

      return reply
        .code(200)
        .send({ message: `Promotion ${promotionId} deleted!` });
    } catch (error) {
      return reply.code(500).send({
        message: "Delete promotion failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // GET /promotions/business/:businessId - get by business
  app.get("/business/:businessId", async (req, reply) => {
    try {
      const params = req.params as { businessId?: string };
      const businessId = params.businessId;

      if (!businessId || isObjectIdValid([businessId]) !== true) {
        return reply.code(400).send({ message: "Invalid businessId!" });
      }

      const query = req.query as { startDate?: string; endDate?: string };
      const startDate = query.startDate;
      const endDate = query.endDate;

      const filter: {
        businessId: Types.ObjectId;
        "promotionPeriod.start"?: { $gte: Date };
        "promotionPeriod.end"?: { $lte: Date };
      } = { businessId: new Types.ObjectId(businessId) };

      if (startDate && endDate) {
        if (startDate > endDate) {
          return reply.code(400).send({
            message: "Invalid date range, start date must be before end date!",
          });
        }
        filter["promotionPeriod.start"] = { $gte: new Date(startDate) };
        filter["promotionPeriod.end"] = { $lte: new Date(endDate) };
      }

      const promotion = await Promotion.find(filter)
        .populate({
          path: "businessGoodsToApplyIds",
          select: "name",
          model: BusinessGood,
        })
        .lean();

      if (!promotion.length) {
        return reply.code(404).send({ message: "No promotion found!" });
      }
      return reply.code(200).send(promotion);
    } catch (error) {
      return reply.code(500).send({
        message: "Get promotion by business id failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });
};

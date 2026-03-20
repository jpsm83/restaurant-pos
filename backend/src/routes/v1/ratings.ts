import type { FastifyPluginAsync } from "fastify";
import { Types } from "mongoose";
import type { IRating } from "../../../../lib/interface/IRating.ts";

import isObjectIdValid from "../../utils/isObjectIdValid.ts";
import Rating from "../../models/rating.ts";
import Business from "../../models/business.ts";
import User from "../../models/user.ts";
import { createAuthHook } from "../../auth/middleware.ts";

export const ratingsRoutes: FastifyPluginAsync = async (app) => {
  // POST /ratings - create
  app.post(
    "/",
    { preValidation: [createAuthHook(app)] },
    async (req, reply) => {
      try {
        if (!req.authSession || req.authSession.type !== "user") {
          return reply.code(401).send({ message: "Unauthorized" });
        }

        const userObjectId = new Types.ObjectId(req.authSession.id);

        const body = req.body as {
          businessId: Types.ObjectId;
          orderId?: Types.ObjectId;
          score: number;
          comment?: string;
        };
        const { businessId, orderId, score, comment } = body;

        if (!businessId || score === undefined) {
          return reply
            .code(400)
            .send({ message: "businessId and score are required!" });
        }

        if (
          typeof score !== "number" ||
          Number.isNaN(score) ||
          score < 0 ||
          score > 5
        ) {
          return reply
            .code(400)
            .send({ message: "score must be a number between 0 and 5!" });
        }

        const idsToValidate = [businessId];
        if (orderId) idsToValidate.push(orderId);
        if (isObjectIdValid(idsToValidate as Types.ObjectId[]) !== true) {
          return reply
            .code(400)
            .send({ message: "Invalid businessId or orderId!" });
        }

        const ratingDoc: IRating = {
          businessId,
          userId: userObjectId,
          score,
          comment: comment || undefined,
        };
        if (orderId) ratingDoc.orderId = orderId;

        const created = await Rating.create(ratingDoc);
        if (!created) {
          return reply.code(500).send({ message: "Failed to create rating" });
        }

        const ratings = await Rating.find({ businessId })
          .select("score")
          .lean();
        const count = ratings.length;
        const sum = ratings.reduce((acc, r) => acc + (r.score ?? 0), 0);
        const averageRating = count > 0 ? sum / count : 0;

        await Business.updateOne(
          { _id: businessId },
          { $set: { averageRating, ratingCount: count } },
        );

        return reply.code(201).send(created);
      } catch (error) {
        return reply.code(500).send({
          message: "Create rating failed!",
          error: error instanceof Error ? error.message : error,
        });
      }
    },
  );

  // GET /ratings/:ratingId - get by ID
  app.get("/:ratingId", async (req, reply) => {
    try {
      const params = req.params as { ratingId?: string };
      const ratingId = params.ratingId;

      if (!ratingId || isObjectIdValid([ratingId]) !== true) {
        return reply.code(400).send({ message: "Invalid ratingId!" });
      }

      const rating = await Rating.findById(ratingId)
        .populate({
          path: "userId",
          select: "personalDetails.firstName personalDetails.lastName username",
          model: User,
        })
        .lean();

      if (!rating) {
        return reply.code(404).send({ message: "Rating not found!" });
      }

      return reply.code(200).send(rating);
    } catch (error) {
      return reply.code(500).send({
        message: "Get rating by id failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // GET /ratings/business/:businessId - get by business
  app.get("/business/:businessId", async (req, reply) => {
    try {
      const params = req.params as { businessId?: string };
      const businessId = params.businessId;

      if (!businessId || isObjectIdValid([businessId]) !== true) {
        return reply.code(400).send({ message: "Invalid businessId!" });
      }

      const query = req.query as { limit?: string; skip?: string };
      const limit = query.limit
        ? Math.min(Math.max(1, Number(query.limit) || 20), 100)
        : 20;
      const skip = query.skip ? Math.max(0, Number(query.skip) || 0) : 0;

      const ratings = await Rating.find({
        businessId: new Types.ObjectId(businessId),
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: "userId",
          select: "personalDetails.firstName personalDetails.lastName username",
          model: User,
        })
        .lean();

      return reply.code(200).send(ratings);
    } catch (error) {
      return reply.code(500).send({
        message: "Get ratings by business failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });
};

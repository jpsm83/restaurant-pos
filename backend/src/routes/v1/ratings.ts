/**
 * Ratings Routes - Customer ratings for businesses.
 *
 * Every route declares its body/params/query as a strict zod DTO from
 * `packages/schemas/ratings.ts`; validation and sanitization happen at the
 * boundary and every error is raised as an `AppError` so the global handler
 * emits RFC 9457 `application/problem+json`.
 */
import type { FastifyPluginAsync } from "fastify";
import { Types } from "mongoose";
import type { IRating } from "../../../../packages/interfaces/IRating.ts";

import Rating from "../../models/rating.ts";
import Business from "../../models/business.ts";
import User from "../../models/user.ts";
import { createAuthHook } from "../../auth/middleware.ts";
import { notFound, unauthorized } from "../../errors/appError.ts";
import {
  createRatingBodySchema,
  ratingIdParamsSchema,
  ratingsByBusinessParamsSchema,
  ratingsPaginationQuerySchema,
  type CreateRatingBody,
  type RatingIdParams,
  type RatingsByBusinessParams,
  type RatingsPaginationQuery,
} from "../../../../packages/schemas/ratings.ts";

const RATING_USER_SELECT =
  "personalDetails.firstName personalDetails.lastName username";

export const ratingsRoutes: FastifyPluginAsync = async (app) => {
  // POST /ratings - create
  app.post<{ Body: CreateRatingBody }>(
    "/",
    {
      preValidation: [createAuthHook(app)],
      schema: { body: createRatingBodySchema },
    },
    async (req, reply) => {
      if (!req.authSession || req.authSession.type !== "user") {
        throw unauthorized("Unauthorized");
      }

      const userObjectId = new Types.ObjectId(req.authSession.id);
      const { businessId, orderId, score, comment } = req.body;
      const businessObjectId = new Types.ObjectId(businessId);

      const ratingDoc: IRating = {
        businessId: businessObjectId,
        userId: userObjectId,
        score,
        comment: comment || undefined,
      };
      if (orderId) ratingDoc.orderId = new Types.ObjectId(orderId);

      const created = await Rating.create(ratingDoc);

      const ratings = await Rating.find({ businessId: businessObjectId })
        .select("score")
        .lean();
      const count = ratings.length;
      const sum = ratings.reduce((acc, r) => acc + (r.score ?? 0), 0);
      const averageRating = count > 0 ? sum / count : 0;

      await Business.updateOne(
        { _id: businessObjectId },
        { $set: { averageRating, ratingCount: count } },
      );

      return reply.code(201).send(created);
    },
  );

  // GET /ratings/:ratingId - get by ID
  app.get<{ Params: RatingIdParams }>(
    "/:ratingId",
    { schema: { params: ratingIdParamsSchema } },
    async (req, reply) => {
      const { ratingId } = req.params;

      const rating = await Rating.findById(ratingId)
        .populate({
          path: "userId",
          select: RATING_USER_SELECT,
          model: User,
        })
        .lean();

      if (!rating) {
        throw notFound("Rating not found!");
      }

      return reply.code(200).send(rating);
    },
  );

  // GET /ratings/business/:businessId - get by business
  app.get<{ Params: RatingsByBusinessParams; Querystring: RatingsPaginationQuery }>(
    "/business/:businessId",
    {
      schema: {
        params: ratingsByBusinessParamsSchema,
        querystring: ratingsPaginationQuerySchema,
      },
    },
    async (req, reply) => {
      const { businessId } = req.params;
      const { limit, skip } = req.query;

      const ratings = await Rating.find({
        businessId: new Types.ObjectId(businessId),
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: "userId",
          select: RATING_USER_SELECT,
          model: User,
        })
        .lean();

      return reply.code(200).send(ratings);
    },
  );
};

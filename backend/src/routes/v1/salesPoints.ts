/**
 * SalesPoints Routes — sales point reads and listings.
 *
 * The unsafe legacy mutations are retired until the sales-points build-order
 * row lands; every route here still requires a live User session at the v1
 * gate.
 */
import type { FastifyPluginAsync } from "fastify";

import SalesPoint from "../../models/salesPoint.ts";
import { notFound } from "../../errors/appError.ts";
import { withSoftDeleteFilter } from "../../models/softDelete.ts";
import {
  salesPointIdParamsSchema,
  salesPointsIncludeDeletedQuerySchema,
  type SalesPointIdParams,
  type SalesPointsIncludeDeletedQuery,
} from "restaurant-pos-packages/schemas/salesPoints";

export const salesPointsRoutes: FastifyPluginAsync = async (app) => {
  // GET /salesPoints - list all
  app.get<{ Querystring: SalesPointsIncludeDeletedQuery }>(
    "/",
    { schema: { querystring: salesPointsIncludeDeletedQuerySchema } },
    async (req, reply) => {
      const { includeDeleted = false } = req.query;
      const salesPoints = await SalesPoint.find(
        withSoftDeleteFilter({}, includeDeleted),
      ).lean();

      if (!salesPoints.length) {
        throw notFound("No salesPoints found!");
      }
      return reply.code(200).send(salesPoints);
    },
  );

  // GET /salesPoints/:salesPointId - get by ID
  app.get<{
    Params: SalesPointIdParams;
    Querystring: SalesPointsIncludeDeletedQuery;
  }>(
    "/:salesPointId",
    {
      schema: {
        params: salesPointIdParamsSchema,
        querystring: salesPointsIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { salesPointId } = req.params;
      const { includeDeleted = false } = req.query;

      const salesPoint = await SalesPoint.findOne(
        withSoftDeleteFilter({ _id: salesPointId }, includeDeleted),
      ).lean();

      if (!salesPoint) {
        throw notFound("No salesPoint found!");
      }
      return reply.code(200).send(salesPoint);
    },
  );
};

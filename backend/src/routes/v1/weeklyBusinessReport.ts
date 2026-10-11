/**
 * WeeklyBusinessReport Routes — report retrieval with optional business and
 * week-range filters.
 *
 * Every route declares its params/query as a strict zod DTO from
 * `packages/schemas/businessReports.ts`; validation happens at the boundary and
 * every error is raised as an `AppError` so the global handler emits RFC 9457
 * `application/problem+json`. The week-range ordering rule stays in the route as
 * a named post-parse check.
 */
import type { FastifyPluginAsync } from "fastify";
import { Types } from "mongoose";

import WeeklyBusinessReport from "../../models/weeklyBusinessReport.ts";
import { badRequest, notFound } from "../../errors/appError.ts";
import {
  weeklyBusinessParamsSchema,
  weeklyBusinessReportListQuerySchema,
  weeklyBusinessReportRangeQuerySchema,
  weeklyReportIdParamsSchema,
  type WeeklyBusinessParams,
  type WeeklyBusinessReportListQuery,
  type WeeklyBusinessReportRangeQuery,
  type WeeklyReportIdParams,
} from "../../../../packages/schemas/businessReports.ts";

/** The business-local midnight a `YYYY-MM-DD` week start resolves to. */
function parseWeekStart(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** The last instant of the week that starts at `weekStart`. */
function weekEnd(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export const weeklyBusinessReportRoutes: FastifyPluginAsync = async (app) => {
  // GET /weeklyBusinessReport - list all (with optional filters)
  app.get<{ Querystring: WeeklyBusinessReportListQuery }>(
    "/",
    { schema: { querystring: weeklyBusinessReportListQuerySchema } },
    async (req, reply) => {
      const { businessId, startWeek, endWeek } = req.query;

      const filter: {
        businessId?: Types.ObjectId;
        weekReference?: { $gte: Date; $lte: Date };
      } = {};

      if (businessId) {
        filter.businessId = new Types.ObjectId(businessId);
      }

      if (startWeek && endWeek) {
        const start = parseWeekStart(startWeek);
        const end = parseWeekStart(endWeek);
        if (start > weekEnd(end)) {
          throw badRequest(
            "Invalid week range, startWeek must be before or equal to endWeek.",
          );
        }
        filter.weekReference = { $gte: start, $lte: weekEnd(end) };
      }

      const reports = await WeeklyBusinessReport.find(filter)
        .sort({ weekReference: -1 })
        .lean();

      if (!reports.length) {
        throw notFound("No weekly reports found!");
      }

      return reply.code(200).send(reports);
    },
  );

  // GET /weeklyBusinessReport/:weeklyReportId - get by ID
  app.get<{ Params: WeeklyReportIdParams }>(
    "/:weeklyReportId",
    { schema: { params: weeklyReportIdParamsSchema } },
    async (req, reply) => {
      const { weeklyReportId } = req.params;

      const report = await WeeklyBusinessReport.findById(weeklyReportId).lean();

      if (!report) {
        throw notFound("Weekly report not found!");
      }

      return reply.code(200).send(report);
    },
  );

  // GET /weeklyBusinessReport/business/:businessId - get by business
  app.get<{
    Params: WeeklyBusinessParams;
    Querystring: WeeklyBusinessReportRangeQuery;
  }>(
    "/business/:businessId",
    {
      schema: {
        params: weeklyBusinessParamsSchema,
        querystring: weeklyBusinessReportRangeQuerySchema,
      },
    },
    async (req, reply) => {
      const { businessId } = req.params;
      const { startWeek, endWeek } = req.query;

      const filter: {
        businessId: Types.ObjectId;
        weekReference?: { $gte: Date; $lte: Date };
      } = {
        businessId: new Types.ObjectId(businessId),
      };

      if (startWeek && endWeek) {
        const start = parseWeekStart(startWeek);
        const end = parseWeekStart(endWeek);
        if (start > weekEnd(end)) {
          throw badRequest(
            "Invalid week range, startWeek must be before or equal to endWeek.",
          );
        }
        filter.weekReference = { $gte: start, $lte: weekEnd(end) };
      }

      const reports = await WeeklyBusinessReport.find(filter)
        .sort({ weekReference: 1 })
        .lean();

      if (!reports.length) {
        throw notFound("No weekly reports found!");
      }

      return reply.code(200).send(reports);
    },
  );
};

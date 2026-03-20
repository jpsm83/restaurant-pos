import type { FastifyPluginAsync } from "fastify";
import { Types } from "mongoose";

import { isObjectIdValid } from "../../utils/isObjectIdValid.ts";
import WeeklyBusinessReport from "../../models/weeklyBusinessReport.ts";

function parseWeekStart(dateStr: string): Date | null {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekEnd(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export const weeklyBusinessReportRoutes: FastifyPluginAsync = async (app) => {
  // GET /weeklyBusinessReport - list all (with optional filters)
  app.get("/", async (req, reply) => {
    try {
      const queryParams = req.query as {
        businessId?: string;
        startWeek?: string;
        endWeek?: string;
      };

      const filter: {
        businessId?: Types.ObjectId;
        weekReference?: { $gte: Date; $lte: Date };
      } = {};

      if (queryParams.businessId) {
        if (isObjectIdValid([queryParams.businessId]) !== true) {
          return reply.code(400).send({ message: "Invalid business ID!" });
        }
        filter.businessId = new Types.ObjectId(queryParams.businessId);
      }

      if (queryParams.startWeek && queryParams.endWeek) {
        const start = parseWeekStart(queryParams.startWeek);
        const end = parseWeekStart(queryParams.endWeek);
        if (!start || !end) {
          return reply.code(400).send({
            message: "Invalid week range. Use startWeek and endWeek as ISO dates (YYYY-MM-DD).",
          });
        }
        if (start > weekEnd(end)) {
          return reply.code(400).send({
            message: "Invalid week range, startWeek must be before or equal to endWeek.",
          });
        }
        filter.weekReference = { $gte: start, $lte: weekEnd(end) };
      }

      const reports = await WeeklyBusinessReport.find(filter)
        .sort({ weekReference: -1 })
        .lean();

      if (!reports.length) {
        return reply.code(404).send({ message: "No weekly reports found!" });
      }

      return reply.code(200).send(reports);
    } catch (error) {
      return reply.code(500).send({
        message: "Get weekly business reports failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // GET /weeklyBusinessReport/:weeklyReportId - get by ID
  app.get("/:weeklyReportId", async (req, reply) => {
    try {
      const params = req.params as { weeklyReportId?: string };
      const weeklyReportId = params.weeklyReportId;

      if (!weeklyReportId || isObjectIdValid([weeklyReportId]) !== true) {
        return reply.code(400).send({ message: "Invalid weekly report ID!" });
      }

      const report = await WeeklyBusinessReport.findById(weeklyReportId).lean();

      if (!report) {
        return reply.code(404).send({ message: "Weekly report not found!" });
      }

      return reply.code(200).send(report);
    } catch (error) {
      return reply.code(500).send({
        message: "Get weekly business report by id failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // GET /weeklyBusinessReport/business/:businessId - get by business
  app.get("/business/:businessId", async (req, reply) => {
    try {
      const params = req.params as { businessId?: string };
      const businessId = params.businessId;

      if (!businessId || isObjectIdValid([businessId]) !== true) {
        return reply.code(400).send({ message: "Invalid business ID!" });
      }

      const queryParams = req.query as {
        startWeek?: string;
        endWeek?: string;
      };

      const filter: {
        businessId: Types.ObjectId;
        weekReference?: { $gte: Date; $lte: Date };
      } = {
        businessId: new Types.ObjectId(businessId),
      };

      if (queryParams.startWeek && queryParams.endWeek) {
        const start = parseWeekStart(queryParams.startWeek);
        const end = parseWeekStart(queryParams.endWeek);
        if (!start || !end) {
          return reply.code(400).send({
            message: "Invalid week range. Use startWeek and endWeek as YYYY-MM-DD.",
          });
        }
        if (start > weekEnd(end)) {
          return reply.code(400).send({
            message: "Invalid week range, startWeek must be before or equal to endWeek.",
          });
        }
        filter.weekReference = { $gte: start, $lte: weekEnd(end) };
      }

      const reports = await WeeklyBusinessReport.find(filter)
        .sort({ weekReference: 1 })
        .lean();

      if (!reports.length) {
        return reply.code(404).send({ message: "No weekly reports found!" });
      }

      return reply.code(200).send(reports);
    } catch (error) {
      return reply.code(500).send({
        message: "Get weekly business reports by business id failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });
};

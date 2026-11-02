/**
 * Printers Routes — printer reads and per-business listings.
 *
 * The unsafe legacy mutations are retired until the printers build-order row
 * lands; every route here still requires a live User session at the v1 gate.
 */
import type { FastifyPluginAsync } from "fastify";

import Printer from "../../models/printer.ts";
import Employee from "../../models/employee.ts";
import SalesPoint from "../../models/salesPoint.ts";
import { notFound } from "../../errors/appError.ts";
import { withSoftDeleteFilter } from "../../models/softDelete.ts";
import {
  printerIdParamsSchema,
  printersByBusinessParamsSchema,
  printersIncludeDeletedQuerySchema,
  type PrinterIdParams,
  type PrintersByBusinessParams,
  type PrintersIncludeDeletedQuery,
} from "../../schemas/printers.ts";

const PRINTER_POPULATE = [
  {
    path: "backupPrinterId",
    select: "printerAlias",
    model: Printer,
  },
  {
    path: "employeesAllowedToPrintDataIds",
    select: "employeeName",
    model: Employee,
  },
  {
    path: "configurationSetupToPrintOrders.salesPointIds",
    select: "salesPointName",
    model: SalesPoint,
  },
  {
    path: "configurationSetupToPrintOrders.excludeEmployeeIds",
    select: "employeeName",
    model: Employee,
  },
];

export const printersRoutes: FastifyPluginAsync = async (app) => {
  // GET /printers - list all
  app.get<{ Querystring: PrintersIncludeDeletedQuery }>(
    "/",
    { schema: { querystring: printersIncludeDeletedQuerySchema } },
    async (req, reply) => {
      const { includeDeleted = false } = req.query;
      const printers = await Printer.find(
        withSoftDeleteFilter({}, includeDeleted),
      )
        .populate(PRINTER_POPULATE)
        .lean();

      if (!printers.length) {
        throw notFound("No printers found!");
      }
      return reply.code(200).send(printers);
    },
  );

  // GET /printers/:printerId - get by ID
  app.get<{
    Params: PrinterIdParams;
    Querystring: PrintersIncludeDeletedQuery;
  }>(
    "/:printerId",
    {
      schema: {
        params: printerIdParamsSchema,
        querystring: printersIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { printerId } = req.params;
      const { includeDeleted = false } = req.query;

      const printer = await Printer.findOne(
        withSoftDeleteFilter({ _id: printerId }, includeDeleted),
      )
        .populate(PRINTER_POPULATE)
        .lean();

      if (!printer) {
        throw notFound("Printer not found!");
      }
      return reply.code(200).send(printer);
    },
  );

  // GET /printers/business/:businessId - get by business
  app.get<{
    Params: PrintersByBusinessParams;
    Querystring: PrintersIncludeDeletedQuery;
  }>(
    "/business/:businessId",
    {
      schema: {
        params: printersByBusinessParamsSchema,
        querystring: printersIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { businessId } = req.params;
      const { includeDeleted = false } = req.query;

      const printers = await Printer.find(
        withSoftDeleteFilter({ businessId }, includeDeleted),
      )
        .populate(PRINTER_POPULATE)
        .lean();

      if (!printers.length) {
        throw notFound("No printers found!");
      }
      return reply.code(200).send(printers);
    },
  );
};

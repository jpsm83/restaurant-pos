/**
 * Printers Routes - Printer CRUD and configuration-setup management.
 *
 * Every route declares its body/params as a strict zod DTO from
 * `backend/src/schemas/printers.ts`; validation and sanitization happen at the
 * boundary and every error is raised as an `AppError` so the global handler
 * emits RFC 9457 `application/problem+json`. Connectivity checks and the
 * duplicate alias/ip/employee and configuration-combination rules span the
 * database and stay as named post-parse checks, as do the non-empty array
 * rules.
 */
import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type { IPrinter } from "restaurant-pos-packages/interfaces/IPrinter";

import checkPrinterConnection from "../../printers/checkPrinterConnection.ts";
import Printer from "../../models/printer.ts";
import Employee from "../../models/employee.ts";
import SalesPoint from "../../models/salesPoint.ts";
import { markAsDeletedById, withSoftDeleteFilter } from "../../models/softDelete.ts";
import {
  badRequest,
  conflict,
  internal,
  notFound,
} from "../../errors/appError.ts";
import {
  configurationSetupBodySchema,
  configurationSetupParamsSchema,
  createPrinterBodySchema,
  printerIdParamsSchema,
  printersByBusinessParamsSchema,
  printersIncludeDeletedQuerySchema,
  updatePrinterBodySchema,
  type ConfigurationSetupBody,
  type ConfigurationSetupParams,
  type CreatePrinterBody,
  type PrinterIdParams,
  type PrintersByBusinessParams,
  type PrintersIncludeDeletedQuery,
  type UpdatePrinterBody,
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

/**
 * Post-parse non-empty rule: an id list, when sent, must contain at least one
 * element. ObjectId format is already enforced by the DTO.
 */
const assertNonEmptyIds = (
  ids: string[] | undefined,
  message: string,
): void => {
  if (ids !== undefined && ids.length === 0) {
    throw badRequest(message);
  }
};

/**
 * Post-parse connectivity check: recompute `printerStatus` only when the client
 * supplied both `ipAddress` and `port`, so a partial update never triggers a
 * spurious connection attempt.
 */
const resolvePrinterStatus = async (
  ipAddress: string | undefined,
  port: number | undefined,
): Promise<"Online" | "Offline" | undefined> => {
  if (!ipAddress || !port) return undefined;
  const isOnline = await checkPrinterConnection(ipAddress, port);
  return isOnline ? "Online" : "Offline";
};

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

  // POST /printers - create
  app.post<{ Body: CreatePrinterBody }>(
    "/",
    { schema: { body: createPrinterBodySchema } },
    async (req, reply) => {
      const {
        printerAlias,
        description,
        ipAddress,
        port,
        businessId,
        backupPrinterId,
        employeesAllowedToPrintDataIds,
      } = req.body;

      const duplicatePrinter = await Printer.findOne(withSoftDeleteFilter({
        businessId,
        $or: [{ printerAlias }, { ipAddress }],
      }));

      if (duplicatePrinter) {
        throw conflict("Printer already exists with printerAlias or ipAddress!");
      }

      const printerStatus = await resolvePrinterStatus(ipAddress, port);

      await Printer.create({
        printerAlias,
        description: description || undefined,
        printerStatus: printerStatus ?? "Offline",
        ipAddress,
        port,
        businessId,
        backupPrinterId: backupPrinterId || undefined,
        employeesAllowedToPrintDataIds: employeesAllowedToPrintDataIds || [],
      });

      return reply.code(201).send({
        message: `Printer ${printerAlias} created successfully`,
      });
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

  // PATCH /printers/:printerId - update
  app.patch<{ Params: PrinterIdParams; Body: UpdatePrinterBody }>(
    "/:printerId",
    {
      schema: {
        params: printerIdParamsSchema,
        body: updatePrinterBodySchema,
      },
    },
    async (req, reply) => {
      const { printerId } = req.params;
      const {
        printerAlias,
        description,
        ipAddress,
        port,
        backupPrinterId,
        employeesAllowedToPrintDataIds,
      } = req.body;

      const printer = (await Printer.findOne(
        withSoftDeleteFilter({ _id: printerId }),
      )
        .select("businessId")
        .lean()) as unknown as IPrinter | null;

      if (!printer) {
        throw notFound("Printer not found!");
      }

      const conflictConditions: Record<string, unknown>[] = [];
      if (printerAlias) conflictConditions.push({ printerAlias });
      if (ipAddress) conflictConditions.push({ ipAddress });
      if (employeesAllowedToPrintDataIds && employeesAllowedToPrintDataIds.length)
        conflictConditions.push({
          employeesAllowedToPrintDataIds: {
            $in: employeesAllowedToPrintDataIds,
          },
        });

      const conflictingPrinter = conflictConditions.length
        ? ((await Printer.findOne({
              ...withSoftDeleteFilter({
                _id: { $ne: printerId },
                businessId: printer.businessId,
                $or: conflictConditions,
              }),
            }).lean()) as unknown as IPrinter | null)
        : null;

      if (conflictingPrinter) {
        const detail =
          conflictingPrinter.printerAlias === printerAlias ||
          conflictingPrinter.ipAddress === ipAddress
            ? "Printer already exists!"
            : "EmployeesAllowedToPrintDataIds are already being used in some other printer!";
        throw conflict(detail);
      }

      const printerStatus = await resolvePrinterStatus(ipAddress, port);

      const updatePrinterObj: Partial<IPrinter> = {};
      if (printerAlias) updatePrinterObj.printerAlias = printerAlias;
      if (description) updatePrinterObj.description = description;
      if (ipAddress) updatePrinterObj.ipAddress = ipAddress;
      if (port) updatePrinterObj.port = port;
      if (backupPrinterId)
        updatePrinterObj.backupPrinterId = new Types.ObjectId(backupPrinterId);
      if (employeesAllowedToPrintDataIds)
        updatePrinterObj.employeesAllowedToPrintDataIds =
          employeesAllowedToPrintDataIds.map((id) => new Types.ObjectId(id));
      if (printerStatus) updatePrinterObj.printerStatus = printerStatus;

      const updatedPrinter = await Printer.findOneAndUpdate(
        withSoftDeleteFilter({ _id: printerId }),
        { $set: updatePrinterObj },
        { returnDocument: "after", lean: true },
      );

      if (!updatedPrinter) {
        throw notFound("Printer not found!");
      }

      return reply.code(200).send({ message: "Printer updated successfully" });
    },
  );

  // DELETE /printers/:printerId - delete (transaction)
  app.delete<{ Params: PrinterIdParams }>(
    "/:printerId",
    { schema: { params: printerIdParamsSchema } },
    async (req, reply) => {
      const { printerId } = req.params;

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const printer = await Printer.findById(printerId)
          .select("deleted")
          .session(session)
          .lean();

        if (!printer) {
          await session.abortTransaction();
          throw notFound("Printer not found!");
        }
        if (printer.deleted) {
          await session.abortTransaction();
          throw conflict("Printer already deleted!");
        }

        const isBackupPrinter = await Printer.exists({
          ...withSoftDeleteFilter({ backupPrinterId: printerId }),
        }).session(session);

        if (isBackupPrinter) {
          const updatedPrinter = await Printer.updateMany(
            withSoftDeleteFilter({ backupPrinterId: printerId }),
            { $unset: { backupPrinterId: "" } },
            { session },
          );

          if (!updatedPrinter) {
            await session.abortTransaction();
            throw internal("Failed to update the backup printer!");
          }
        }

        const wasDeleted = await markAsDeletedById(
          Printer as mongoose.Model<IPrinter & { deleted: boolean }>,
          printerId,
        );
        if (!wasDeleted) {
          await session.abortTransaction();
          throw conflict("Printer already deleted!");
        }

        await session.commitTransaction();

        return reply
          .code(200)
          .send({ message: `Printer ${printerId} deleted!` });
      } catch (error) {
        await session.abortTransaction().catch(() => undefined);
        throw error;
      } finally {
        session.endSession();
      }
    },
  );

  // PATCH /printers/:printerId/addConfigurationSetup - add config
  app.patch<{ Params: PrinterIdParams; Body: ConfigurationSetupBody }>(
    "/:printerId/addConfigurationSetup",
    {
      schema: {
        params: printerIdParamsSchema,
        body: configurationSetupBodySchema,
      },
    },
    async (req, reply) => {
      const { printerId } = req.params;
      const { mainCategory, subCategories, salesPointIds, excludeEmployeeIds } =
        req.body;

      if (salesPointIds.length === 0) {
        throw badRequest(
          "salesPointIds is required and must be an array of ObjectIds!",
        );
      }
      assertNonEmptyIds(
        excludeEmployeeIds,
        "ExcludeEmployeeIds must be an array of ObjectIds!",
      );
      if (subCategories && subCategories.length === 0) {
        throw badRequest("SubCategories must be an array of strings!");
      }

      const existingCombination = await Printer.findOne({
        ...withSoftDeleteFilter({ _id: printerId }),
        configurationSetupToPrintOrders: {
          $elemMatch: {
            mainCategory,
            $or: [
              { subCategories: { $exists: false } },
              { subCategories: { $size: 0 } },
              { subCategories: { $in: subCategories } },
            ],
          },
        },
      }).lean();

      if (existingCombination) {
        throw conflict(
          "A combination of these mainCategory and subCategories already exists!",
        );
      }

      const updatedPrinter = await Printer.findOneAndUpdate(
        withSoftDeleteFilter({ _id: printerId }),
        {
          $push: {
            configurationSetupToPrintOrders: {
              mainCategory,
              subCategories,
              salesPointIds,
              excludeEmployeeIds,
            },
          },
        },
        { returnDocument: "after", lean: true },
      );

      if (!updatedPrinter) {
        throw notFound("PrinterId not found!");
      }

      return reply.code(201).send({
        message:
          "Configuration setup to print orders add to printer successfully",
      });
    },
  );

  // PATCH /printers/:printerId/deleteConfigurationSetup/:configId - delete config
  app.patch<{ Params: ConfigurationSetupParams }>(
    "/:printerId/deleteConfigurationSetup/:configId",
    { schema: { params: configurationSetupParamsSchema } },
    async (req, reply) => {
      const { printerId, configId } = req.params;

      const updatedPrinter = await Printer.findOneAndUpdate(
        withSoftDeleteFilter({ _id: printerId }),
        {
          $pull: {
            configurationSetupToPrintOrders: { _id: configId },
          },
        },
        { returnDocument: "after", lean: true },
      );

      if (!updatedPrinter) {
        throw notFound("Configuration setup to print orders not found!");
      }

      return reply.code(200).send({
        message: "Configuration setup to print orders successfully deleted!",
      });
    },
  );

  // PATCH /printers/:printerId/editConfigurationSetup/:configId - edit config
  app.patch<{ Params: ConfigurationSetupParams; Body: ConfigurationSetupBody }>(
    "/:printerId/editConfigurationSetup/:configId",
    {
      schema: {
        params: configurationSetupParamsSchema,
        body: configurationSetupBodySchema,
      },
    },
    async (req, reply) => {
      const { printerId, configId } = req.params;
      const { mainCategory, subCategories, salesPointIds, excludeEmployeeIds } =
        req.body;

      if (salesPointIds.length === 0) {
        throw badRequest(
          "salesPointIds is required and must be an array of ObjectIds!",
        );
      }
      assertNonEmptyIds(
        excludeEmployeeIds,
        "excludeEmployeeIds must be an array of ObjectIds!",
      );

      const existingCombination = await Printer.exists({
        ...withSoftDeleteFilter({ _id: printerId }),
        configurationSetupToPrintOrders: {
          $elemMatch: {
            _id: { $ne: configId },
            mainCategory,
            subCategories: { $in: subCategories },
          },
        },
      });

      if (existingCombination) {
        throw conflict(
          "A combination of this mainCategory and one of the subCategories already exists!",
        );
      }

      const updatedPrinter = await Printer.findOneAndUpdate(
        {
          ...withSoftDeleteFilter({ _id: printerId }),
          "configurationSetupToPrintOrders._id": configId,
        },
        {
          $set: {
            "configurationSetupToPrintOrders.$.salesPointIds": salesPointIds,
            "configurationSetupToPrintOrders.$.excludeEmployeeIds":
              excludeEmployeeIds,
            "configurationSetupToPrintOrders.$.mainCategory": mainCategory,
            "configurationSetupToPrintOrders.$.subCategories":
              subCategories || [],
          },
        },
        { returnDocument: "after", lean: true },
      );

      if (!updatedPrinter) {
        throw notFound("Printer or configuration setup to print orders not found!");
      }

      return reply.code(200).send({
        message: "Configuration setup to print orders updated successfully",
      });
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

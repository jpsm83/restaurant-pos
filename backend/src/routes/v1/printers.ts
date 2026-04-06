import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type {
  IPrinter,
  IConfigurationSetupToPrintOrders,
} from "../../../../packages/interfaces/IPrinter.ts";

import isObjectIdValid from "../../utils/isObjectIdValid.ts";
import checkPrinterConnection from "../../printers/checkPrinterConnection.ts";
import Printer from "../../models/printer.ts";
import Employee from "../../models/employee.ts";
import SalesPoint from "../../models/salesPoint.ts";

export const printersRoutes: FastifyPluginAsync = async (app) => {
  // GET /printers - list all
  app.get("/", async (req, reply) => {
    try {
      const printers = await Printer.find()
        .populate({
          path: "backupPrinterId",
          select: "printerAlias",
          model: Printer,
        })
        .populate({
          path: "employeesAllowedToPrintDataIds",
          select: "employeeName",
          model: Employee,
        })
        .populate({
          path: "configurationSetupToPrintOrders.salesPointIds",
          select: "salesPointName",
          model: SalesPoint,
        })
        .populate({
          path: "configurationSetupToPrintOrders.excludeEmployeeIds",
          select: "employeeName",
          model: Employee,
        })
        .lean();

      if (!printers.length) {
        return reply.code(404).send({ message: "No printers found!" });
      }
      return reply.code(200).send(printers);
    } catch (error) {
      return reply.code(500).send({
        message: "Get all printers failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // POST /printers - create
  app.post("/", async (req, reply) => {
    try {
      const {
        printerAlias,
        description,
        ipAddress,
        port,
        businessId,
        backupPrinterId,
        employeesAllowedToPrintDataIds,
      } = req.body as IPrinter;

      if (!printerAlias || !ipAddress || !port || !businessId) {
        return reply.code(400).send({
          message:
            "PrinterAlias, ipAddress, port and businessId are required fields!",
        });
      }

      if (isObjectIdValid([businessId]) !== true) {
        return reply.code(400).send({ message: "Invalid businessId!" });
      }

      if (backupPrinterId) {
        if (isObjectIdValid([backupPrinterId]) !== true) {
          return reply.code(400).send({ message: "Invalid backupPrinterId!" });
        }
      }

      if (employeesAllowedToPrintDataIds) {
        if (
          !Array.isArray(employeesAllowedToPrintDataIds) ||
          isObjectIdValid(
            employeesAllowedToPrintDataIds as Types.ObjectId[],
          ) !== true
        ) {
          return reply.code(400).send({
            message:
              "EmployeesAllowedToPrintDataIds have to be an array of valid Ids!",
          });
        }
      }

      const duplicatePrinter = await Printer.findOne({
        businessId,
        $or: [{ printerAlias }, { ipAddress }],
      });

      if (duplicatePrinter) {
        return reply.code(400).send({
          message: "Printer already exists with printerAlias or ipAddress!",
        });
      }

      const isOnline = (await checkPrinterConnection(
        ipAddress,
        port,
      )) as boolean;

      const newPrinter = {
        printerAlias,
        description: description || undefined,
        printerStatus: isOnline ? "Online" : "Offline",
        ipAddress,
        port,
        businessId,
        backupPrinterId: backupPrinterId || undefined,
        employeesAllowedToPrintDataIds: employeesAllowedToPrintDataIds || [],
      };

      await Printer.create(newPrinter);

      return reply.code(201).send({
        message: `Printer ${printerAlias} created successfully`,
      });
    } catch (error) {
      return reply.code(500).send({
        message: "Create printer failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // GET /printers/:printerId - get by ID
  app.get("/:printerId", async (req, reply) => {
    try {
      const params = req.params as { printerId?: string };
      const printerId = params.printerId;

      if (!printerId || isObjectIdValid([printerId]) !== true) {
        return reply.code(400).send({ message: "Invalid printerId!" });
      }

      const printer = await Printer.findById(printerId)
        .populate({
          path: "backupPrinterId",
          select: "printerAlias",
          model: Printer,
        })
        .populate({
          path: "employeesAllowedToPrintDataIds",
          select: "employeeName",
          model: Employee,
        })
        .populate({
          path: "configurationSetupToPrintOrders.salesPointIds",
          select: "salesPointName",
          model: SalesPoint,
        })
        .populate({
          path: "configurationSetupToPrintOrders.excludeEmployeeIds",
          select: "employeeName",
          model: Employee,
        })
        .lean();

      if (!printer) {
        return reply.code(404).send({ message: "Printer not found!" });
      }
      return reply.code(200).send(printer);
    } catch (error) {
      return reply.code(500).send({
        message: "Get printer by its id failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // PATCH /printers/:printerId - update
  app.patch("/:printerId", async (req, reply) => {
    try {
      const params = req.params as { printerId?: string };
      const printerId = params.printerId;

      const {
        printerAlias,
        description,
        ipAddress,
        port,
        backupPrinterId,
        employeesAllowedToPrintDataIds,
      } = req.body as IPrinter;

      if (!printerId || isObjectIdValid([printerId]) !== true) {
        return reply.code(400).send({ message: "Invalid printerId!" });
      }

      if (backupPrinterId) {
        if (isObjectIdValid([backupPrinterId]) !== true) {
          return reply.code(400).send({ message: "Invalid backupPrinterId!" });
        }
      }

      if (employeesAllowedToPrintDataIds) {
        if (
          !Array.isArray(employeesAllowedToPrintDataIds) ||
          isObjectIdValid(
            employeesAllowedToPrintDataIds as Types.ObjectId[],
          ) !== true
        ) {
          return reply.code(400).send({
            message:
              "EmployeesAllowedToPrintDataIds have to be an array of valid Ids!",
          });
        }
      }

      const printer = (await Printer.findById(printerId)
        .select("businessId")
        .lean()) as unknown as IPrinter | null;

      if (!printer) {
        return reply.code(404).send({ message: "Printer not found!" });
      }

      const conflictingPrinter = (await Printer.findOne({
        _id: { $ne: printerId },
        businessId: printer.businessId,
        $or: [
          { printerAlias },
          { ipAddress },
          {
            employeesAllowedToPrintDataIds: {
              $in: employeesAllowedToPrintDataIds,
            },
          },
        ],
      }).lean()) as unknown as IPrinter | null;

      if (conflictingPrinter) {
        const message =
          conflictingPrinter.printerAlias === printerAlias ||
          conflictingPrinter.ipAddress === ipAddress
            ? "Printer already exists!"
            : "EmployeesAllowedToPrintDataIds are already being used in some other printer!";
        return reply.code(400).send({ message });
      }

      const isOnline = (await checkPrinterConnection(
        ipAddress,
        port,
      )) as boolean;

      const updatePrinterObj: Partial<IPrinter> = {
        printerStatus: isOnline ? "Online" : "Offline",
      };

      if (printerAlias) updatePrinterObj.printerAlias = printerAlias;
      if (description) updatePrinterObj.description = description;
      if (ipAddress) updatePrinterObj.ipAddress = ipAddress;
      if (port) updatePrinterObj.port = port;
      if (backupPrinterId) updatePrinterObj.backupPrinterId = backupPrinterId;
      if (employeesAllowedToPrintDataIds)
        updatePrinterObj.employeesAllowedToPrintDataIds =
          employeesAllowedToPrintDataIds;

      const updatedPrinter = await Printer.findByIdAndUpdate(
        printerId,
        { $set: updatePrinterObj },
        { returnDocument: 'after', lean: true },
      );

      if (!updatedPrinter) {
        return reply.code(404).send({ message: "Printer not found!" });
      }

      return reply.code(200).send({ message: "Printer updated successfully" });
    } catch (error) {
      return reply.code(500).send({
        message: "Update printer failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // DELETE /printers/:printerId - delete (transaction)
  app.delete("/:printerId", async (req, reply) => {
    const params = req.params as { printerId?: string };
    const printerId = params.printerId;

    if (!printerId || isObjectIdValid([printerId]) !== true) {
      return reply.code(400).send({ message: "Invalid printerId!" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const result = await Printer.deleteOne({ _id: printerId }, { session });

      if (result.deletedCount === 0) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "Printer not found!" });
      }

      const isBackupPrinter = await Printer.exists({
        backupPrinterId: printerId,
      }).session(session);

      if (isBackupPrinter) {
        const updatedPrinter = await Printer.updateMany(
          { backupPrinterId: printerId },
          { $unset: { backupPrinterId: "" } },
          { session },
        );

        if (!updatedPrinter) {
          await session.abortTransaction();
          return reply.code(500).send({
            message: "Failed to update the backup printer!",
          });
        }
      }

      await session.commitTransaction();

      return reply.code(200).send({ message: `Printer ${printerId} deleted!` });
    } catch (error) {
      await session.abortTransaction();
      return reply.code(500).send({
        message: "Delete printer failed!",
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      session.endSession();
    }
  });

  // PATCH /printers/:printerId/addConfigurationSetup - add config
  app.patch("/:printerId/addConfigurationSetup", async (req, reply) => {
    try {
      const params = req.params as { printerId?: string };
      const printerId = params.printerId;

      const { mainCategory, subCategories, salesPointIds, excludeEmployeeIds } =
        req.body as IConfigurationSetupToPrintOrders;

      if (!printerId || isObjectIdValid([printerId]) !== true) {
        return reply.code(400).send({ message: "Invalid printId!" });
      }

      if (
        !salesPointIds ||
        salesPointIds.length === 0 ||
        !Array.isArray(salesPointIds) ||
        isObjectIdValid(salesPointIds as Types.ObjectId[]) !== true ||
        !mainCategory
      ) {
        return reply.code(400).send({
          message:
            "salesPointIds is required and must be an array of ObjectIds!",
        });
      }

      if (excludeEmployeeIds) {
        if (
          !Array.isArray(excludeEmployeeIds) ||
          excludeEmployeeIds.length === 0 ||
          isObjectIdValid(excludeEmployeeIds as Types.ObjectId[]) !== true
        ) {
          return reply.code(400).send({
            message: "ExcludeEmployeeIds must be an array of ObjectIds!",
          });
        }
      }

      if (subCategories) {
        if (!Array.isArray(subCategories) || subCategories.length === 0) {
          return reply.code(400).send({
            message: "SubCategories must be an array of strings!",
          });
        }
      }

      const existingCombination = await Printer.findOne({
        _id: printerId,
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
        return reply.code(400).send({
          message:
            "A combination of these mainCategory and subCategories already exists!",
        });
      }

      const updatedPrinter = await Printer.findOneAndUpdate(
        { _id: printerId },
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
        { returnDocument: 'after', lean: true },
      );

      if (!updatedPrinter) {
        return reply.code(404).send({ message: "PrinterId not found!" });
      }

      return reply.code(201).send({
        message:
          "Configuration setup to print orders add to printer successfully",
      });
    } catch (error) {
      return reply.code(500).send({
        message: "Configuration setup to print orders creation failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // PATCH /printers/:printerId/deleteConfigurationSetup/:configId - delete config
  app.patch(
    "/:printerId/deleteConfigurationSetup/:configId",
    async (req, reply) => {
      try {
        const params = req.params as { printerId?: string; configId?: string };
        const { printerId, configId } = params;

        if (
          !printerId ||
          !configId ||
          isObjectIdValid([printerId, configId]) !== true
        ) {
          return reply.code(400).send({
            message: "Invalid printerId or configurationSetupToPrintOrdersId!",
          });
        }

        const updatedPrinter = await Printer.findOneAndUpdate(
          { _id: printerId },
          {
            $pull: {
              configurationSetupToPrintOrders: { _id: configId },
            },
          },
          { returnDocument: 'after', lean: true },
        );

        if (!updatedPrinter) {
          return reply.code(404).send({
            message: "Configuration setup to print orders not found!",
          });
        }

        return reply.code(200).send({
          message: "Configuration setup to print orders successfully deleted!",
        });
      } catch (error) {
        return reply.code(500).send({
          message: "Delete configuration setup to print orders failed!",
          error: error instanceof Error ? error.message : error,
        });
      }
    },
  );

  // PATCH /printers/:printerId/editConfigurationSetup/:configId - edit config
  app.patch(
    "/:printerId/editConfigurationSetup/:configId",
    async (req, reply) => {
      try {
        const params = req.params as { printerId?: string; configId?: string };
        const { printerId, configId } = params;

        const {
          mainCategory,
          subCategories,
          salesPointIds,
          excludeEmployeeIds,
        } = req.body as IConfigurationSetupToPrintOrders;

        if (
          !printerId ||
          !configId ||
          isObjectIdValid([printerId, configId]) !== true
        ) {
          return reply.code(400).send({
            message: "Invalid printerId or configurationSetupToPrintOrdersId!",
          });
        }

        if (
          !salesPointIds ||
          salesPointIds.length === 0 ||
          !Array.isArray(salesPointIds) ||
          isObjectIdValid(salesPointIds as Types.ObjectId[]) !== true ||
          !mainCategory
        ) {
          return reply.code(400).send({
            message:
              "salesPointIds is required and must be an array of ObjectIds!",
          });
        }

        if (excludeEmployeeIds) {
          if (
            !Array.isArray(excludeEmployeeIds) ||
            excludeEmployeeIds.length === 0 ||
            isObjectIdValid(excludeEmployeeIds as Types.ObjectId[]) !== true
          ) {
            return reply.code(400).send({
              message: "excludeEmployeeIds must be an array of ObjectIds!",
            });
          }
        }

        if (subCategories) {
          if (!Array.isArray(subCategories)) {
            return reply.code(400).send({
              message: "subCategories must be an array of strings!",
            });
          }
        }

        const existingCombination = await Printer.exists({
          _id: printerId,
          configurationSetupToPrintOrders: {
            $elemMatch: {
              _id: { $ne: configId },
              mainCategory,
              subCategories: { $in: subCategories },
            },
          },
        });

        if (existingCombination) {
          return reply.code(400).send({
            message:
              "A combination of this mainCategory and one of the subCategories already exists!",
          });
        }

        const updatedPrinter = await Printer.findOneAndUpdate(
          {
            _id: printerId,
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
          { returnDocument: 'after', lean: true },
        );

        if (!updatedPrinter) {
          return reply.code(404).send({
            message:
              "Printer or configuration setup to print orders not found!",
          });
        }

        return reply.code(200).send({
          message: "Configuration setup to print orders updated successfully",
        });
      } catch (error) {
        return reply.code(500).send({
          message: "Update configuration setup to print orders failed!",
          error: error instanceof Error ? error.message : error,
        });
      }
    },
  );

  // GET /printers/business/:businessId - get by business
  app.get("/business/:businessId", async (req, reply) => {
    try {
      const params = req.params as { businessId?: string };
      const businessId = params.businessId;

      if (!businessId || isObjectIdValid([businessId]) !== true) {
        return reply.code(400).send({ message: "Invalid businessId!" });
      }

      const printers = await Printer.find({ businessId })
        .populate({
          path: "backupPrinterId",
          select: "printerAlias",
          model: Printer,
        })
        .populate({
          path: "employeesAllowedToPrintDataIds",
          select: "employeeName",
          model: Employee,
        })
        .populate({
          path: "configurationSetupToPrintOrders.salesPointIds",
          select: "salesPointName",
          model: SalesPoint,
        })
        .populate({
          path: "configurationSetupToPrintOrders.excludeEmployeeIds",
          select: "employeeName",
          model: Employee,
        })
        .lean();

      if (!printers.length) {
        return reply.code(404).send({ message: "No printers found!" });
      }
      return reply.code(200).send(printers);
    } catch (error) {
      return reply.code(500).send({
        message: "Get printers by businessId id failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });
};

import connectDb from "@/app/lib/utils/connectDb";
import mongoose, { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported interfaces
import { IPrinter } from "@/app/lib/interface/IPrinter";

// imported utils
import { checkPrinterConnection } from "../utils/checkPrinterConnection";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Printer from "@/app/lib/models/printer";
import Employee from "@/app/lib/models/employee";
import SalesPoint from "@/app/lib/models/salesPoint";

// @desc    Get printer by ID
// @route   GET /printers/:printerId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { printerId: Types.ObjectId } }
) => {
  try {
    const printerId = context.params.printerId;
    // check if printerId is valid
    if (isObjectIdValid([printerId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid printerId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    // connect before first call to DB
    await connectDb();

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

    return !printer
      ? new NextResponse(JSON.stringify({ message: "Printer not found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(printer), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get printer by its id failed!", error);
  }
};

// @desc    Update printer by ID
// @route   PATCH /printers/:printerId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { printerId: Types.ObjectId } }
) => {
  try {
    const printerId = context.params.printerId;

    const {
      printerAlias,
      description,
      ipAddress,
      port,
      backupPrinterId,
      employeesAllowedToPrintDataIds,
    } = (await req.json()) as IPrinter;

    // check if printerId is valid
    if (isObjectIdValid([printerId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid printerId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // validate backupPrinterId if it exists
    if (backupPrinterId) {
      if (isObjectIdValid([backupPrinterId]) !== true) {
        return new NextResponse(
          JSON.stringify({ message: "Invalid backupPrinterId!" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // validate employeesAllowedToPrintDataIds if it exists
    if (employeesAllowedToPrintDataIds) {
      if (
        !Array.isArray(employeesAllowedToPrintDataIds) ||
        isObjectIdValid(employeesAllowedToPrintDataIds) !== true
      ) {
        return new NextResponse(
          JSON.stringify({
            message:
              "EmployeesAllowedToPrintDataIds have to be an array of valid Ids!",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // connect before first call to DB
    await connectDb();

    // fetch the printer with the given ID
    const printer: IPrinter | null = await Printer.findById(printerId)
      .select("businessId")
      .lean();
    if (!printer) {
      return new NextResponse(
        JSON.stringify({ message: "Printer not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // combine duplicate printer check and employeesAllowedToPrintDataIds check into a single query
    const conflictingPrinter: IPrinter | null = await Printer.findOne({
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
    }).lean();

    if (conflictingPrinter) {
      const message =
        conflictingPrinter.printerAlias === printerAlias ||
        conflictingPrinter.ipAddress === ipAddress
          ? "Printer already exists!"
          : "EmployeesAllowedToPrintDataIds are already being used in some other printer!";
      return new NextResponse(JSON.stringify({ message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // printerStatus is auto check on the backend
    const isOnline = (await checkPrinterConnection(ipAddress, port)) as boolean;

    // create updated printer object
    const updatePrinterObj: Partial<IPrinter> = {
      printerStatus: isOnline ? "Online" : "Offline",
    };

    // populate updated fields
    if (printerAlias) updatePrinterObj.printerAlias = printerAlias;
    if (description) updatePrinterObj.description = description;
    if (ipAddress) updatePrinterObj.ipAddress = ipAddress;
    if (port) updatePrinterObj.port = port;
    if (backupPrinterId) updatePrinterObj.backupPrinterId = backupPrinterId;
    if (employeesAllowedToPrintDataIds)
      updatePrinterObj.employeesAllowedToPrintDataIds =
        employeesAllowedToPrintDataIds;

    // update the printer
    const updatedPrinter = await Printer.findByIdAndUpdate(
      printerId,
      { $set: updatePrinterObj },
      {
        new: true,
        lean: true,
      }
    );

    if (!updatedPrinter) {
      return new NextResponse(
        JSON.stringify({ message: "Printer not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: "Printer updated successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Update printer failed!", error);
  }
};

// @desc    Delete printer by ID
// @route   DELETE /printers/:printerId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { printerId: Types.ObjectId } }
) => {
  const printerId = context.params.printerId;

  // check if printerId is valid
  if (isObjectIdValid([printerId]) !== true) {
    return new NextResponse(JSON.stringify({ message: "Invalid printerId!" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // connect before first call to DB
  await connectDb();

  // Start a session to handle transactions
  // with session if any error occurs, the transaction will be aborted
  // session is created outside of the try block to be able to abort it in the catch/finally block
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // delete printer and check if it existed
    const result = await Printer.deleteOne(
      { _id: printerId },
      { new: true, session }
    );

    if (result.deletedCount === 0) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Printer not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // check if printer is a backup printer
    const isBackupPrinter = await Printer.exists({
      backupPrinterId: printerId,
    });

    if (isBackupPrinter) {
      const updatedPrinter = await Printer.updateMany(
        {
          backupPrinterId: printerId,
        },
        {
          $unset: { backupPrinterId: "" },
        },
        { new: true, session }
      );

      if (!updatedPrinter) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({
            message: "Failed to update the backup printer!",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Commit the transaction if both operations succeed
    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({ message: `Printer ${printerId} deleted!` }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Delete printer failed!", error);
  } finally {
    session.endSession();
  }
};

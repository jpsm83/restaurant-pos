import { NextResponse } from "next/server";

// imported interfaces
import { IPrinter } from "@/app/lib/interface/IPrinter";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { checkPrinterConnection } from "./utils/checkPrinterConnection";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// import employee model
import Employee from "@/app/lib/models/employee";
import Printer from "@/app/lib/models/printer";
import SalesPoint from "@/app/lib/models/salesPoint";

// @desc    Get all printers
// @route   GET /printers
// @access  Private
export const GET = async (req: Request) => {
  try {
    // connect before first call to DB
    await connectDb();

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

    return !printers.length
      ? new NextResponse(JSON.stringify({ message: "No printers found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(printers), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get all printers failed!", error);
  }
};

// printer is created without any definition of what or where it will be printed and also without any employee allowed to print data
// all those properties will be add on update routes for the printer
// @desc    Create new printer
// @desc    POST /businessId
// @access  Private
export const POST = async (req: Request) => {
  try {
    const {
      printerAlias,
      description,
      ipAddress,
      port,
      businessId,
      backupPrinterId,
      employeesAllowedToPrintDataIds,
    } = (await req.json()) as IPrinter;

    // check required fields
    if (!printerAlias || !ipAddress || !port || !businessId) {
      return new NextResponse(
        JSON.stringify({
          message:
            "PrinterAlias, ipAddress, port and businessId are required fields!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // validate businessId
    if (isObjectIdValid([businessId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId!" }),
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

    //check duplicate printer
    const duplicatePrinter = await Printer.findOne({
      businessId,
      $or: [{ printerAlias }, { ipAddress }],
    });

    if (duplicatePrinter) {
      return new NextResponse(
        JSON.stringify({
          message: `Printer already exists with printerAlias or ipAddress!`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // printerStatus is auto check on the backend
    const isOnline = (await checkPrinterConnection(ipAddress, port)) as boolean;

    // create printer object with required fields
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

    // create a new printer
    await Printer.create(newPrinter);

    // confirm printer was created
    return new NextResponse(
      JSON.stringify({
        message: `Printer ${printerAlias} created successfully`,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Create printer failed!", error);
  }
};

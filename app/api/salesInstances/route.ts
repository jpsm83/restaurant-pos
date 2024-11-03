import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";

// import utils
import connectDb from "@/app/lib/utils/connectDb";
import { createDailySalesReport } from "../dailySalesReports/utils/createDailySalesReport";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { createSalesInstance } from "./utils/createSalesInstance";

// import interfaces
import { IDailySalesReport } from "@/app/lib/interface/IDailySalesReport";
import { ISalesInstance } from "@/app/lib/interface/ISalesInstance";

// imported models
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import Employee from "@/app/lib/models/employee";
import BusinessGood from "@/app/lib/models/businessGood";
import Order from "@/app/lib/models/order";
import SalesInstance from "@/app/lib/models/salesInstance";
import SalesPoint from "@/app/lib/models/salesPoint";
import Customer from "@/app/lib/models/customer";

// @desc    Get all salesInstances
// @route   GET /salesInstances
// @access  Private
export const GET = async (req: Request) => {
  try {
    // connect before first call to DB
    await connectDb();

    const salesInstances = await SalesInstance.find()
      .populate({
        path: "salesPointId",
        select: "salesPointName salesPointType selfOrdering",
        model: SalesPoint,
      })
      .populate({
        path: "openedByCustomerId",
        select: "customerName",
        model: Customer,
      })
      .populate({
        path: "openedByEmployeeId responsibleById closedById",
        select: "employeeName currentShiftRole",
        model: Employee,
      })
      .populate({
        path: "salesGroup.ordersIds",
        select:
          "billingStatus orderStatus orderGrossPrice orderNetPrice paymentMethod allergens promotionApplyed discountPercentage createdAt businessGoodsIds",
        populate: {
          path: "businessGoodsIds",
          select: "name mainCategory subCategory allergens sellingPrice",
          model: BusinessGood,
        },
        model: Order,
      })
      .lean();

    return !salesInstances?.length
      ? new NextResponse(
          JSON.stringify({ message: "No salesInstances found!" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        )
      : new NextResponse(JSON.stringify(salesInstances), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get all salesInstances failed!", error);
  }
};

// first create a empty salesInstance, then update it with the salesGroup.ordersIds
// @desc    Create new salesInstances
// @route   POST /salesInstances
// @access  Private
export const POST = async (req: Request) => {
  // ************ IMPORTANT ************
  // only employees can open a table to be populated with orders in this route
  // self ordering will have its own route
  const {
    salesPointId,
    guests,
    salesInstanceStatus,
    openedByEmployeeId,
    businessId,
    clientName,
  } = (await req.json()) as ISalesInstance;

  // check required fields
  if (!salesPointId || !guests || !openedByEmployeeId || !businessId) {
    return new NextResponse(
      JSON.stringify({
        message:
          "SalesInstanceReference, guest, openedByEmployeeId and businessId are required!",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // validate ids
  if (
    isObjectIdValid([salesPointId, openedByEmployeeId, businessId]) !== true
  ) {
    return new NextResponse(
      JSON.stringify({
        message: "OpenedByEmployeeId or businessId not valid!",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // connect before first call to DB
  await connectDb();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {

    const [employee, salesPoint, dailySalesReport] = await Promise.all([
      // check if openedByEmployeeId is an employee or a customer
      Employee.exists({ _id: openedByEmployeeId }),
      // check if salesPointId exists
      SalesPoint.exists({ _id: salesPointId }),
      DailySalesReport.findOne({
        isDailyReportOpen: true,
        businessId,
      })
        .select("dailyReferenceNumber")
        .lean() as Promise<IDailySalesReport>,
    ]);

    // check salesPointId exists
    if (!salesPoint || !employee) {
      await session.abortTransaction();
      const message = !salesPoint
        ? "Sales point does not exist!"
        : "Employee does not exist!";
      return new NextResponse(
        JSON.stringify({
          message: message,
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // **** IMPORTANT ****
    // dailySalesReport is created when the first salesInstance of the day is created
    const dailyReferenceNumber = dailySalesReport
      ? dailySalesReport.dailyReferenceNumber
      : await createDailySalesReport(businessId, session);

    if (typeof dailyReferenceNumber === "string") {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: dailyReferenceNumber }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (
      await SalesInstance.exists({
        dailyReferenceNumber: dailyReferenceNumber,
        businessId,
        salesPointId,
        status: { $ne: "Closed" },
      })
    ) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({
          message: "SalesInstance already exists and it is not closed!",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // create new salesInstance
    const newSalesInstanceObj: ISalesInstance = {
      dailyReferenceNumber,
      salesPointId,
      guests,
      salesInstanceStatus,
      openedByEmployeeId,
      businessId,
      clientName,
    };

    // we use a outside function to create the salesInstance because this function is used in other places
    // create new salesInstance
    await createSalesInstance(newSalesInstanceObj, session);

    return new NextResponse(
      JSON.stringify({
        message: "SalesInstance created successfully!",
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Create salesInstance failed!", error);
  }
};

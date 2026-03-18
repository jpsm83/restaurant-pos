import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { Types } from "mongoose";

// import utils
import connectDb from "@/lib/db/connectDb";
import { createDailySalesReport } from "../dailySalesReports/utils/createDailySalesReport";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import { createSalesInstance } from "./utils/createSalesInstance";

// import interfaces
import { IDailySalesReport } from "@shared/interfaces/IDailySalesReport";
import { ISalesInstance } from "@shared/interfaces/ISalesInstance";

// imported models
import BusinessGood from "@/lib/db/models/businessGood";
import DailySalesReport from "@/lib/db/models/dailySalesReport";
import Employee from "@/lib/db/models/employee";
import Order from "@/lib/db/models/order";
import SalesInstance from "@/lib/db/models/salesInstance";
import SalesPoint from "@/lib/db/models/salesPoint";
import User from "@/lib/db/models/user";
import mongoose from "mongoose";

// @desc    Get all salesInstances
// @route   GET /salesInstances
// @access  Private
export const GET = async () => {
  try {
    await connectDb();

    const salesInstances = await SalesInstance.find()
      .populate({
        path: "salesPointId",
        select: "salesPointName salesPointType selfOrdering",
        model: SalesPoint,
      })
      .populate({
        path: "openedByUserId",
        select: "personalDetails.firstName personalDetails.lastName",
        model: User,
      })
      .populate({
        path: "responsibleByUserId closedByUserId",
        select: "personalDetails.firstName personalDetails.lastName",
        model: User,
      })
      .populate({
        path: "salesGroup.ordersIds",
        select:
          "billingStatus orderStatus orderGrossPrice orderNetPrice paymentMethod allergens promotionApplyed discountPercentage createdAt businessGoodId addOns",
        populate: [
          {
            path: "businessGoodId",
            select: "name mainCategory subCategory allergens sellingPrice",
            model: BusinessGood,
          },
          {
            path: "addOns",
            select: "name mainCategory subCategory allergens sellingPrice",
            model: BusinessGood,
          },
        ],
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
    return handleApiError("Get all salesInstances failed!", error instanceof Error ? error.message : String(error));
  }
};

// @desc    Create new salesInstances (staff opening a table)
// @route   POST /salesInstances
// @access  Private
export const POST = async (req: Request) => {
  const token = await getToken({
    req: req as Parameters<typeof getToken>[0]["req"],
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.id || token.type !== "user") {
    return new NextResponse(
      JSON.stringify({ message: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  const openedByUserId = new Types.ObjectId(token.id as string);

  const {
    salesPointId,
    guests,
    salesInstanceStatus,
    businessId,
    clientName,
  } = (await req.json()) as ISalesInstance;

  if (!salesPointId || !guests || !businessId) {
    return new NextResponse(
      JSON.stringify({
        message:
          "SalesPointId, guests and businessId are required!",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (isObjectIdValid([salesPointId, businessId]) !== true) {
    return new NextResponse(
      JSON.stringify({
        message: "SalesPointId or businessId not valid!",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  await connectDb();

  const employee = (await Employee.findOne({
    userId: openedByUserId,
    businessId,
  })
    .select("onDuty")
    .lean()) as { onDuty: boolean } | null;
  if (!employee || !employee.onDuty) {
    return new NextResponse(
      JSON.stringify({
        message: "You must be an on-duty employee to open a table from the POS.",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const [salesPoint, dailySalesReport] = await Promise.all([
      SalesPoint.exists({ _id: salesPointId }),
      DailySalesReport.findOne({
        isDailyReportOpen: true,
        businessId,
      })
        .select("dailyReferenceNumber")
        .lean() as unknown as Promise<IDailySalesReport | null>,
    ]);

    if (!salesPoint) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Sales point does not exist!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

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

    const existingOpen = await SalesInstance.exists({
      dailyReferenceNumber,
      businessId,
      salesPointId,
      salesInstanceStatus: { $ne: "Closed" },
    });

    if (existingOpen) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({
          message: "SalesInstance already exists and it is not closed!",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    const newSalesInstanceObj: ISalesInstance = {
      dailyReferenceNumber,
      salesPointId,
      guests,
      salesInstanceStatus: salesInstanceStatus ?? "Occupied",
      openedByUserId,
      openedAsRole: "employee",
      businessId,
      clientName,
    };

    const result = await createSalesInstance(newSalesInstanceObj, session);
    if (typeof result === "string") {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: result }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await session.commitTransaction();
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
    await session.abortTransaction();
    return handleApiError("Create salesInstance failed!", error instanceof Error ? error.message : String(error));
  } finally {
    session.endSession();
  }
};

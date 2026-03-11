import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { getToken } from "next-auth/jwt";

import connectDb from "@/lib/db/connectDb";
import { createDailySalesReport } from "@/app/api/v1/dailySalesReports/utils/createDailySalesReport";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import { createSalesInstance } from "../../../utils/createSalesInstance";

import { IDailySalesReport } from "@/lib/interface/IDailySalesReport";
import { ISalesInstance } from "@/lib/interface/ISalesInstance";

import DailySalesReport from "@/lib/db/models/dailySalesReport";
import Employee from "@/lib/db/models/employee";
import SalesInstance from "@/lib/db/models/salesInstance";
import SalesPoint from "@/lib/db/models/salesPoint";

/**
 * Employee opens a table by scanning the table's QR (open table only, no orders).
 * Same QR can be used by customer for self-order when sales point has selfOrdering true.
 * Identity from session; employee must be on-duty for the business.
 *
 * @route   POST /api/v1/salesInstances/selfOrderingLocation/:selfOrderingLocationId/openTable
 * @access  Private (user session, employee on-duty)
 */
export const POST = async (
  req: Request,
  context: { params: { selfOrderingLocationId: Types.ObjectId } }
) => {
  try {
    const selfOrderingLocationId = context.params.selfOrderingLocationId;

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

    const body = (await req.json()) as { businessId: Types.ObjectId; guests?: number };
    const businessId = body?.businessId;
    const guests = body?.guests ?? 1;

    if (!businessId) {
      return new NextResponse(
        JSON.stringify({ message: "businessId is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (isObjectIdValid([selfOrderingLocationId, businessId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid selfOrderingLocationId or businessId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await connectDb();

    const salesPoint = (await SalesPoint.findById(selfOrderingLocationId)
      .select("businessId")
      .lean()) as { businessId: Types.ObjectId | { _id: Types.ObjectId } } | null;
    if (!salesPoint) {
      return new NextResponse(
        JSON.stringify({ message: "Sales point not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }
    const salesPointBusinessId =
      typeof salesPoint.businessId === "object" && salesPoint.businessId !== null && "_id" in salesPoint.businessId
        ? (salesPoint.businessId as { _id: Types.ObjectId })._id
        : (salesPoint.businessId as Types.ObjectId);
    if (salesPointBusinessId.toString() !== businessId.toString()) {
      return new NextResponse(
        JSON.stringify({ message: "Sales point does not belong to this business" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const employee = (await Employee.findOne({
      userId: openedByUserId,
      businessId,
    })
      .select("onDuty")
      .lean()) as { onDuty: boolean } | null;
    if (!employee || !employee.onDuty) {
      return new NextResponse(
        JSON.stringify({ message: "Employee must be on duty to open a table from QR" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const dailySalesReport = (await DailySalesReport.findOne({
        isDailyReportOpen: true,
        businessId,
      })
        .select("dailyReferenceNumber")
        .lean()) as unknown as (Pick<IDailySalesReport, "dailyReferenceNumber"> & { _id: unknown }) | null;

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
        salesPointId: selfOrderingLocationId,
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
        salesPointId: selfOrderingLocationId,
        guests,
        salesInstanceStatus: "Occupied",
        openedByUserId,
        openedAsRole: "employee",
        businessId,
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
      return new NextResponse(JSON.stringify(result), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (error) {
    return handleApiError(
      "Open table from QR failed!",
      error instanceof Error ? error.message : String(error)
    );
  }
};

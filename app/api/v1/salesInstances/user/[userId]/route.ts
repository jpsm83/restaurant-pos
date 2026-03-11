import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import utils
import { handleApiError } from "@/lib/db/handleApiError";
import connectDb from "@/lib/db/connectDb";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";

// import models
import SalesInstance from "@/lib/db/models/salesInstance";
import Employee from "@/lib/db/models/employee";
import BusinessGood from "@/lib/db/models/businessGood";
import Order from "@/lib/db/models/order";
import SalesPoint from "@/lib/db/models/salesPoint";
import Customer from "@/app/lib/models/customer";

// @desc   Get salesInstances by employee ID
// @route  GET /salesInstances/employee/:employeeId
// @access Private
export const GET = async (
  req: Request,
  context: { params: { employeeId: Types.ObjectId } }
) => {
  try {
    const employeeId = context.params.employeeId;

    // validate salesInstanceId
    if (isObjectIdValid([employeeId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid salesInstanceId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

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

    return !salesInstances.length
      ? new NextResponse(
          JSON.stringify({ message: "No salesInstances found!" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        )
      : new NextResponse(JSON.stringify(salesInstances), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError(
      "Fail to get all salesInstances by employee ID!",
      error instanceof Error ? error.message : String(error)
    );
  }
};

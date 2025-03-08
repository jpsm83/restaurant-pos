import { NextResponse } from "next/server";
import { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Order from "@/app/lib/models/order";
import Employee from "@/app/lib/models/employee";
import BusinessGood from "@/app/lib/models/businessGood";
import SalesInstance from "@/app/lib/models/salesInstance";
import SalesPoint from "@/app/lib/models/salesPoint";
import Customer from "@/app/lib/models/customer";

// @desc    Get orders salesInstance ID
// @route   GET /orders/salesInstance/:salesInstanceId
// @access  Private
export const GET = async (
  req: Request,
  context: {
    params: { salesInstanceId: Types.ObjectId };
  }
) => {
  try {
    const salesInstanceId = context.params.salesInstanceId;

    // validate salesInstanceId
    if (isObjectIdValid([salesInstanceId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "SalesInstanceId is not valid!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    const orders = await Order.find({ salesInstanceId: salesInstanceId })
      .populate({
        path: "salesInstanceId",
        select: "salesPointId",
        populate: {
          path: "salesPointId",
          select: "salesPointName",
          model: SalesPoint,
        },
        model: SalesInstance,
      })
      .populate({
        path: "employeeId",
        select: "employeeName allEmployeeRoles currentShiftRole",
        model: Employee,
      })
      .populate({
        path: "customerId",
        select: "employeeName allEmployeeRoles currentShiftRole",
        model: Customer,
      })
      .populate({
        path: "businessGoodsIds",
        select:
          "name mainCategory subCategory productionTime sellingPrice allergens",
        model: BusinessGood,
      })
      .lean();

    return !orders.length
      ? new NextResponse(JSON.stringify({ message: "No orders found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(orders), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get all orders by salesInstance ID failed!", error);
  }
};

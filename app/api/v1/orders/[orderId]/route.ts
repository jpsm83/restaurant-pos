import connectDb from "@/lib/db/connectDb";
import { NextResponse } from "next/server";

// import interfaces
import mongoose, { Types } from "mongoose";

// import utils
import { handleApiError } from "@/lib/db/handleApiError";
import { cancelOrders } from "../utils/cancelOrders";

// import models
import Order from "@/lib/db/models/order";
import Employee from "@/lib/db/models/employee";
import BusinessGood from "@/lib/db/models/businessGood";
import SalesInstance from "@/lib/db/models/salesInstance";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import SalesPoint from "@/lib/db/models/salesPoint";
import User from "@/lib/db/models/user";

// @desc    Get order by ID
// @route   GET /orders/:orderId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { orderId: Types.ObjectId } }
) => {
  try {
    const orderId = context.params.orderId;

    // validate ids
    if (isObjectIdValid([orderId]) !== true) {
      return new NextResponse(
        JSON.stringify({
          message: "OrderId not valid!",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    const order = await Order.findById(orderId)
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
        path: "userId",
        select: "employeeName allEmployeeRoles currentShiftRole",
        model: User,
      })
      .populate({
        path: "businessGoodId",
        select:
          "name mainCategory subCategory productionTime sellingPrice allergens",
        model: BusinessGood,
      })
      .populate({
        path: "addOns",
        select:
          "name mainCategory subCategory productionTime sellingPrice allergens",
        model: BusinessGood,
      })
      .lean();

    return !order
      ? new NextResponse(JSON.stringify({ message: "Order not found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(order), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get order by its id failed!", error as string);
  }
};

// delete a order shouldnt be allowed for data integrity and historical purposes
// the only case where a order should be deleted is if the business itself is deleted
// or if the order was created by mistake and has billing status "Cancel"
// @desc    Delete order by ID
// @route   DELETE /orders/:orderId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { orderId: Types.ObjectId } }
) => {
  // connect before first call to DB
  await connectDb();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const orderId = context.params.orderId;

    // cancelOrder will update the dynamic count of the business goods, update the sales instance and order status and them delete the order
    const cancelOrdersResult = await cancelOrders([orderId], session);

    if (cancelOrdersResult !== true) {
      await session.abortTransaction();
      return new NextResponse(JSON.stringify({ message: cancelOrdersResult }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({ message: "Order deleted successfully!" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Delete order failed!", error as string);
  } finally {
    session.endSession();
  }
};

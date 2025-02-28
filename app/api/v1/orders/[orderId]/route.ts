import connectDb from "@/app/lib/utils/connectDb";
import { NextResponse } from "next/server";

// import interfaces
import mongoose, { Types } from "mongoose";

// import utils
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { cancelOrders } from "../utils/cancelOrders";

// import models
import Order from "@/app/lib/models/order";
import Employee from "@/app/lib/models/employee";
import BusinessGood from "@/app/lib/models/businessGood";
import SalesInstance from "@/app/lib/models/salesInstance";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import SalesPoint from "@/app/lib/models/salesPoint";
import Customer from "@/app/lib/models/customer";

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
    return handleApiError("Get order by its id failed!", error);
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
      return new NextResponse(
        JSON.stringify({ message: cancelOrdersResult }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new NextResponse(
      JSON.stringify({ message: "Order deleted successfully!" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Delete order failed!", error);
  }
};

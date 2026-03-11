import connectDb from "@/lib/db/connectDb";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import mongoose, { Types } from "mongoose";

import { handleApiError } from "@/lib/db/handleApiError";
import { hasManagementRole } from "@/lib/constants";
import { cancelOrders } from "../utils/cancelOrders";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import Order from "@/lib/db/models/order";
import Employee from "@/lib/db/models/employee";
import BusinessGood from "@/lib/db/models/businessGood";
import SalesInstance from "@/lib/db/models/salesInstance";
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
        path: "createdByUserId",
        select: "personalDetails.firstName personalDetails.lastName",
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
// @access  Private (on-duty management role required)
export const DELETE = async (
  req: Request,
  context: { params: { orderId: Types.ObjectId } }
) => {
  await connectDb();

  const orderId = context.params.orderId;
  if (isObjectIdValid([orderId]) !== true) {
    return new NextResponse(
      JSON.stringify({ message: "OrderId not valid!" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const token = await getToken({
    req: req as Parameters<typeof getToken>[0]["req"],
    secret: process.env.NEXTAUTH_SECRET,
  });
  const sessionUserId = token?.id && token.type === "user" ? new Types.ObjectId(token.id as string) : null;
  if (!sessionUserId) {
    return new NextResponse(
      JSON.stringify({ message: "Unauthorized; userId from session is required to cancel orders!" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const orderDoc = await Order.findById(orderId)
      .select("businessId")
      .session(session)
      .lean() as { businessId: Types.ObjectId } | null;

    if (!orderDoc) {
      await session.abortTransaction();
      return new NextResponse(JSON.stringify({ message: "Order not found!" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const businessId = typeof orderDoc.businessId === "object" && orderDoc.businessId !== null && "_id" in orderDoc.businessId
      ? (orderDoc.businessId as { _id: Types.ObjectId })._id
      : (orderDoc.businessId as Types.ObjectId);

    const employee = (await Employee.findOne({
      userId: sessionUserId,
      businessId,
    })
      .select("allEmployeeRoles onDuty")
      .session(session)
      .lean()) as { allEmployeeRoles?: string[]; onDuty?: boolean } | null;

    if (!employee || !employee.onDuty || !hasManagementRole(employee.allEmployeeRoles)) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Only on-duty management roles can cancel orders!" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

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

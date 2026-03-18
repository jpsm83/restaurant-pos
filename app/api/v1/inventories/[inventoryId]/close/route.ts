import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { getToken } from "next-auth/jwt";

import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import { MANAGEMENT_ROLES } from "@/lib/constants";
import Employee from "@/lib/db/models/employee";
import Inventory from "@/lib/db/models/inventory";
import { IEmployee } from "@shared/interfaces/IEmployee";
import { IInventory } from "@shared/interfaces/IInventory";
import { createNextPeriodInventory } from "../../utils/createNextPeriodInventory";

// @desc    Close current inventory and automatically create next period inventory
// @route   PATCH /api/v1/inventories/:inventoryId/close
// @access  Private (manager only)
export const PATCH = async (
  req: Request,
  context: { params: { inventoryId: Types.ObjectId } }
) => {
  const inventoryId = context.params.inventoryId;

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
  const userId = new Types.ObjectId(token.id as string);

  if (!inventoryId || isObjectIdValid([inventoryId]) !== true) {
    return new NextResponse(
      JSON.stringify({ message: "Valid inventoryId is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  await connectDb();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const inventory = (await Inventory.findById(inventoryId)
      .select("businessId setFinalCount inventoryGoods")
      .lean()
      .session(session)) as IInventory | null;

    if (!inventory) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Inventory not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const businessId = inventory.businessId as Types.ObjectId;
    const employee = (await Employee.findOne({
      userId,
      businessId,
    })
      .select("currentShiftRole businessId")
      .lean()
      .session(session)) as IEmployee | null;

    if (!employee) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Employee not found for this business" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!MANAGEMENT_ROLES.includes(employee.currentShiftRole ?? "")) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({
          message: "You are not allowed to close the inventory!",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    if (employee.businessId?.toString() !== businessId.toString()) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Inventory does not belong to your business" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    if (inventory.setFinalCount) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Inventory is already closed" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await Inventory.updateOne(
      { _id: inventoryId },
      { $set: { setFinalCount: true } },
      { session }
    );

    await createNextPeriodInventory(businessId, inventory as IInventory, session);

    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({
        message:
          "Inventory closed successfully and next period inventory created",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError(
      "Close inventory failed!",
      error instanceof Error ? error.message : String(error)
    );
  } finally {
    session.endSession();
  }
};

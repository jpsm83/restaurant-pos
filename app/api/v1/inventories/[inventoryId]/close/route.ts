import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";

import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import Employee from "@/lib/db/models/employee";
import Inventory from "@/lib/db/models/inventory";
import { IEmployee } from "@/lib/interface/IEmployee";
import { IInventory } from "@/lib/interface/IInventory";
import { createNextPeriodInventory } from "../../utils/createNextPeriodInventory";

const ALLOWED_CLOSE_ROLES = [
  "General Manager",
  "Manager",
  "Assistant Manager",
  "MoD",
  "Admin",
];

// @desc    Close current inventory and automatically create next period inventory
// @route   PATCH /api/v1/inventories/:inventoryId/close
// @access  Private (manager only)
export const PATCH = async (
  req: Request,
  context: { params: { inventoryId: Types.ObjectId } }
) => {
  const inventoryId = context.params.inventoryId;

  let body: { employeeId: Types.ObjectId };
  try {
    body = (await req.json()) as { employeeId: Types.ObjectId };
  } catch {
    return new NextResponse(
      JSON.stringify({ message: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { employeeId } = body;
  if (!inventoryId || !employeeId) {
    return new NextResponse(
      JSON.stringify({ message: "inventoryId and employeeId are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (isObjectIdValid([inventoryId, employeeId]) !== true) {
    return new NextResponse(
      JSON.stringify({ message: "Invalid inventory or employee ID" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  await connectDb();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const [employee, inventory] = await Promise.all([
      Employee.findById(employeeId)
        .select("currentShiftRole onDuty businessId")
        .lean() as Promise<IEmployee | null>,
      Inventory.findById(inventoryId).select("businessId setFinalCount inventoryGoods").lean() as Promise<IInventory | null>,
    ]);

    if (!employee) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Employee not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (
      !ALLOWED_CLOSE_ROLES.includes(employee.currentShiftRole ?? "") ||
      !employee.onDuty
    ) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({
          message: "You are not allowed to close the inventory!",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!inventory) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Inventory not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (inventory.setFinalCount) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Inventory is already closed" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const businessId = inventory.businessId as Types.ObjectId;
    if (employee.businessId?.toString() !== businessId.toString()) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Inventory does not belong to your business" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
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

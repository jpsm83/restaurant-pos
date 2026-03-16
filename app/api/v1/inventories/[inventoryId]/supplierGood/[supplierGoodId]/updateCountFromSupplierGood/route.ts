import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import { MANAGEMENT_ROLES } from "@/lib/constants";
import { IInventory, IInventoryCount } from "@/lib/interface/IInventory";
import { ISupplierGood } from "@/lib/interface/ISupplierGood";
import { IEmployee } from "@/lib/interface/IEmployee";
import Inventory from "@/lib/db/models/inventory";
import SupplierGood from "@/lib/db/models/supplierGood";
import Employee from "@/lib/db/models/employee";

// This PATCH route will update ONLY THE LAST existing count for an individualy supplier good from the inventory
// @desc    Update inventory count for a specific supplier good
// @route   PATCH /inventories/:inventoryId/supplierGood/:supplierGoodId/updateCountFromSupplierGood
// @access  Private (manager or supervisor only; auth from session)
export const PATCH = async (
  req: Request,
  context: {
    params: { inventoryId: Types.ObjectId; supplierGoodId: Types.ObjectId };
  }
) => {
  const { inventoryId, supplierGoodId } = context.params;

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

  const {
    currentCountQuantity,
    comments,
    countId,
    reason,
  } = (await req.json()) as {
    countId: Types.ObjectId;
    reason: string;
    currentCountQuantity?: number;
    comments?: string;
  };

  if (!inventoryId || !supplierGoodId || !countId || !reason) {
    return new NextResponse(
      JSON.stringify({
        message:
          "inventoryId, supplierGoodId, countId and reason are required for re-edit!",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!isObjectIdValid([inventoryId, supplierGoodId, countId])) {
    return new NextResponse(
      JSON.stringify({ message: "One or more IDs are not valid!" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    await connectDb();

    const [inventory, supplierGood] = await Promise.all([
      Inventory.findOne({
        _id: inventoryId,
        "inventoryGoods.supplierGoodId": supplierGoodId,
      })
        .select("businessId setFinalCount inventoryGoods")
        .lean() as Promise<IInventory | null>,
      SupplierGood.findById(supplierGoodId)
        .select("parLevel")
        .lean() as Promise<ISupplierGood | null>,
    ]);

    if (!supplierGood || !inventory) {
      const message = !supplierGood
        ? "Supplier good not found!"
        : "Inventory not found!";
      return new NextResponse(JSON.stringify({ message: message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const businessId = inventory.businessId as Types.ObjectId;
    const employee = (await Employee.findOne({
      userId,
      businessId,
    })
      .select("_id currentShiftRole")
      .lean()) as IEmployee | null;

    if (!employee || !MANAGEMENT_ROLES.includes(employee.currentShiftRole ?? "")) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Only managers or supervisors can re-edit inventory counts!",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if the inventory is finalized
    if (inventory.setFinalCount) {
      return new NextResponse(
        JSON.stringify({
          message: "Inventory already set as final count! Cannot update!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // get the supplier good object with all the counts
    const supplierGoodObject = inventory.inventoryGoods.find(
      (good) => good.supplierGoodId.toString() === supplierGoodId.toString()
    );

    if (!supplierGoodObject) {
      return new NextResponse(
        JSON.stringify({ message: "Supplier good not found in inventory!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // get the especific current count object
    const currentCountObject = supplierGoodObject.monthlyCounts.find(
      (count) => count._id && count._id.toString() === countId.toString()
    );

    if (!currentCountObject) {
      return new NextResponse(JSON.stringify({ message: "Count not found!" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const newQuantity =
      currentCountQuantity !== undefined
        ? currentCountQuantity
        : currentCountObject.currentCountQuantity;

    if (
      currentCountQuantity !== undefined &&
      currentCountObject.currentCountQuantity === currentCountQuantity
    ) {
      return new NextResponse(
        JSON.stringify({ message: "Count is the same, no need to update!" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // calculate the preview dynamic system count
    let previewDynamicSystemCount = 0;
    if (currentCountObject.deviationPercent !== 100) {
      previewDynamicSystemCount =
        currentCountObject.currentCountQuantity /
        (1 - (currentCountObject.deviationPercent ?? 0) / 100);
    }

    // Prepare the new inventory count object (preserve original counter; reeditor from session)
    const updateInventoryCount: IInventoryCount = {
      _id: countId,
      currentCountQuantity: newQuantity,
      quantityNeeded: (supplierGood.parLevel || 0) - newQuantity,
      countedByEmployeeId: currentCountObject.countedByEmployeeId,
      deviationPercent:
        ((previewDynamicSystemCount - newQuantity) /
          (previewDynamicSystemCount || 1)) *
        100,
      comments,
      reedited: {
        reeditedByEmployeeId: employee._id as Types.ObjectId,
        date: new Date(),
        reason,
        originalValues: {
          currentCountQuantity: currentCountObject.currentCountQuantity,
          deviationPercent: currentCountObject.deviationPercent ?? 0,
          dynamicSystemCount: previewDynamicSystemCount,
        },
      },
    };

    // calculate the new average deviation percent
    const totalDeviationPercent =
      supplierGoodObject.monthlyCounts.reduce(
        (acc: number, count: IInventoryCount) =>
          acc + (count.deviationPercent ?? 0),
        0
      ) -
      (currentCountObject.deviationPercent ?? 0) +
      (updateInventoryCount.deviationPercent ?? 0);

    const monthlyCountsWithDeviation = supplierGoodObject.monthlyCounts.filter(
      (count: IInventoryCount) => (count.deviationPercent ?? 0) !== 0
    ).length;

    const averageDeviationPercentCalculation =
      totalDeviationPercent / monthlyCountsWithDeviation;

    // Update the inventory count with optimized query
    await Inventory.updateOne(
      {
        _id: inventoryId,
        "inventoryGoods.supplierGoodId": supplierGoodId,
        "inventoryGoods.monthlyCounts._id": countId,
      },
      {
        $set: {
          "inventoryGoods.$[supplierGood].dynamicSystemCount": newQuantity,
          "inventoryGoods.$[supplierGood].averageDeviationPercent":
            averageDeviationPercentCalculation,
          "inventoryGoods.$[supplierGood].monthlyCounts.$[count]":
            updateInventoryCount,
        },
      },
      {
        arrayFilters: [
          { "supplierGood.supplierGoodId": supplierGoodId },
          { "count._id": countId },
        ],
      }
    );

    return new NextResponse(
      JSON.stringify({ message: "Count updated successfully!" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError(
      "Updating count failed!",
      error instanceof Error ? error.message : String(error)
    );
  }
};

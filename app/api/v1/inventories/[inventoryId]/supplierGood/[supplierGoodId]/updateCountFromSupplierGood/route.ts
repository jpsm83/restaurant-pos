import { Types } from "mongoose";
import { NextResponse } from "next/server";

import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import { IInventory, IInventoryCount } from "@/lib/interface/IInventory";
import { ISupplierGood } from "@/lib/interface/ISupplierGood";
import { IEmployee } from "@/lib/interface/IEmployee";
import Inventory from "@/lib/db/models/inventory";
import SupplierGood from "@/lib/db/models/supplierGood";
import Employee from "@/lib/db/models/employee";

const ALLOWED_REEDIT_ROLES = [
  "General Manager",
  "Manager",
  "Assistant Manager",
  "MoD",
  "Admin",
  "Supervisor",
];

// This PATCH route will update ONLY THE LAST existing count for an individualy supplier good from the inventory
// @desc    Update inventory count for a specific supplier good
// @route   PATCH /inventories/:inventoryId/supplierGood/:supplierGoodIs/updateCountFromSupplierGood
// @access  Private
export const PATCH = async (
  req: Request,
  context: {
    params: { inventoryId: Types.ObjectId; supplierGoodId: Types.ObjectId };
  }
) => {
  const { inventoryId, supplierGoodId } = context.params;

  const {
    currentCountQuantity,
    countedByEmployeeId,
    comments,
    countId,
    reason,
  } = (await req.json()) as IInventoryCount & {
    supplierGoodId: Types.ObjectId;
    countId: Types.ObjectId;
    reason: string;
  };

  if (!inventoryId || !supplierGoodId || !countId || !reason || !countedByEmployeeId) {
    return new NextResponse(
      JSON.stringify({
        message:
          "InventoryId, supplierGoodId, countId, reason and countedByEmployeeId are required for re-edit!",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!isObjectIdValid([inventoryId, supplierGoodId, countId, countedByEmployeeId])) {
    return new NextResponse(
      JSON.stringify({ message: "One or more IDs are not valid!" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    await connectDb();

    const employee = await Employee.findById(countedByEmployeeId)
      .select("currentShiftRole onDuty")
      .lean() as IEmployee | null;
    if (
      !employee ||
      !ALLOWED_REEDIT_ROLES.includes(employee.currentShiftRole ?? "") ||
      !employee.onDuty
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Only managers or supervisors on duty can re-edit inventory counts!",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const [inventory, supplierGood] = await Promise.all([
      Inventory.findOne({
        _id: inventoryId,
        "inventoryGoods.supplierGoodId": supplierGoodId, // Match specific supplierGoodId
      })
        .select("setFinalCount inventoryGoods") // Use $ to project only the matching element from the array
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

    // if count from currentCountObject is equal to the new count we dont need to update the inventory
    if (currentCountObject.currentCountQuantity === currentCountQuantity) {
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

    // Prepare the new inventory count object
    const updateInventoryCount: IInventoryCount = {
      _id: countId,
      currentCountQuantity,
      quantityNeeded: (supplierGood.parLevel || 0) - currentCountQuantity,
      countedByEmployeeId,
      deviationPercent:
        ((previewDynamicSystemCount - currentCountQuantity) /
          (previewDynamicSystemCount || 1)) *
        100,
      comments,
      reedited: {
        reeditedByEmployeeId: countedByEmployeeId,
        date: new Date(),
        reason, // You might want to pass this in the request as well
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
        "inventoryGoods.monthlyCounts._id": countId, // Ensure this matches the correct count
      },
      {
        $set: {
          "inventoryGoods.$[supplierGood].dynamicSystemCount":
            currentCountQuantity,
          "inventoryGoods.$[supplierGood].averageDeviationPercent":
            averageDeviationPercentCalculation,
          "inventoryGoods.$[supplierGood].monthlyCounts.$[count]":
            updateInventoryCount, // Correctly reference monthlyCounts
        },
      },
      {
        arrayFilters: [
          { "supplierGood.supplierGoodId": supplierGoodId }, // Matches supplierGood in inventoryGoods
          { "count._id": countId }, // Matches count in monthlyCounts by _id
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

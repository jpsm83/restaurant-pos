import mongoose, { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported interfaces
import { IInventory, IInventoryCount } from "@/app/lib/interface/IInventory";
import { ISupplierGood } from "@/app/lib/interface/ISupplierGood";

// imported models
import Inventory from "@/app/lib/models/inventory";
import SupplierGood from "@/app/lib/models/supplierGood";

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

  // Check required fields
  if (!inventoryId || !supplierGoodId || !countId || !reason) {
    return new NextResponse(
      JSON.stringify({
        message:
          "InventoryId, supplierGoodId, countId and reason are required!",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Check if the IDs are valid
  if (!isObjectIdValid([inventoryId, supplierGoodId, countId])) {
    return new NextResponse(
      JSON.stringify({ message: "One or more IDs are not valid!" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Connect to the database
    await connectDb();

    // Fetch inventory and supplier good in a single query
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
    const supplierGoodObject: any = inventory.inventoryGoods.find(
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
      (count: any) => count._id.toString() === countId.toString()
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
        (1 - currentCountObject.deviationPercent / 100);
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
          deviationPercent: currentCountObject.deviationPercent,
          dynamicSystemCount: previewDynamicSystemCount,
        },
      },
    };

    // calculate the new average deviation percent
    let totalDeviationPercent =
      supplierGoodObject.monthlyCounts.reduce(
        (acc: number, count: { deviationPercent: number }) =>
          acc + (count.deviationPercent || 0),
        0
      ) -
      currentCountObject.deviationPercent +
      (updateInventoryCount.deviationPercent ?? 0);

    const monthlyCountsWithDeviation = supplierGoodObject.monthlyCounts.filter(
      (count: { deviationPercent: number }) => count.deviationPercent !== 0
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
    return handleApiError("Updating count failed!", error);
  }
};

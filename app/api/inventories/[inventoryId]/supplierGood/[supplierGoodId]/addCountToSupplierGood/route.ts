import { Types } from "mongoose";
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

// this PATCH route will add on individualy supplierGood its new inventory count quantity individually
// @desc    Create new inventories
// @route   PATCH /inventories/:inventoryId/supplierGood/:supplierGoodIs/addCountToSupplierGood
// @access  Private
export const PATCH = async (
  req: Request,
  context: {
    params: { inventoryId: Types.ObjectId; supplierGoodId: Types.ObjectId };
  }
) => {
  // this function will set the count quantity of a individual supplier good in an inventory
  const { inventoryId, supplierGoodId } = context.params;

  const { currentCountQuantity, countedByEmployeeId, comments } =
    (await req.json()) as IInventoryCount & {
      supplierGoodId: Types.ObjectId;
    };

  // check required fields
  if (!inventoryId || !supplierGoodId || !currentCountQuantity) {
    return new NextResponse(
      JSON.stringify({
        message:
          "InventoryId, supplierGoodId and currentCountQuantity are required!",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // check if the inventoryId is valid
  if (!isObjectIdValid([inventoryId, supplierGoodId, countedByEmployeeId])) {
    return new NextResponse(
      JSON.stringify({ message: "InventoryId or supplierGoodId not valid!" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // connect before first call to DB
    await connectDb();

    // Fetch inventory and supplier good in a single query
    const [inventory, supplierGood] = await Promise.all([
      Inventory.findOne({
        _id: inventoryId,
        "inventoryGoods.supplierGoodId": supplierGoodId, // Match specific supplierGoodId
      })
        .select("setFinalCount inventoryGoods.$") // Use $ to project only the matching element from the array
        .lean() as Promise<IInventory | null>,
      SupplierGood.findById(supplierGoodId)
        .select("parLevel")
        .lean() as Promise<ISupplierGood | null>,
    ]);

    if (!supplierGood || !inventory) {
      let message = !supplierGood
        ? "Supplier good not found!"
        : "Inventory not found!";
      return new NextResponse(JSON.stringify({ message: message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // check if the inventory is already set as final count (finalized)
    if (inventory.setFinalCount) {
      return new NextResponse(
        JSON.stringify({
          message: "Inventory already set as final count! Cannot update!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get the matching supplierGood object
    const inventoryGood = inventory.inventoryGoods[0];

    // Check if count did not change
    if (currentCountQuantity === inventoryGood.dynamicSystemCount) {
      return new NextResponse(
        JSON.stringify({
          message: "Inventory count didn't change from last count!",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Prepare the new inventory count object
    const newInventoryCount: IInventoryCount = {
      currentCountQuantity,
      quantityNeeded: (supplierGood.parLevel || 0) - currentCountQuantity,
      countedByEmployeeId,
      deviationPercent:
        ((inventoryGood.dynamicSystemCount - currentCountQuantity) /
          (inventoryGood.dynamicSystemCount || 1)) *
        100,
      comments,
    };

    // calculate the average deviation percent
    let totalDeviationPercent = inventoryGood.monthlyCounts.reduce(
      (acc, count) => acc + (count.deviationPercent || 0),
      0
    );

    const monthlyCountsWithDeviation = inventoryGood.monthlyCounts.filter(
      (count) => count.deviationPercent !== 0
    ).length;

    const averageDeviationPercentCalculation =
      (totalDeviationPercent + (newInventoryCount.deviationPercent ?? 0)) /
      (monthlyCountsWithDeviation + 1);

    await Promise.all([
      // First Update: Set the previous lastCount to false
      Inventory.updateOne(
        {
          _id: inventoryId,
          "inventoryGoods.supplierGoodId": supplierGoodId,
          "inventoryGoods.monthlyCounts.lastCount": true, // Find the previous "last" count
        },
        {
          $set: {
            "inventoryGoods.$[elem].monthlyCounts.$[count].lastCount": false,
          },
        },
        {
          arrayFilters: [
            { "elem.supplierGoodId": supplierGoodId },
            { "count.lastCount": true },
          ],
        }
      ),

      // Second Update: Add the new count and update dynamicSystemCount
      Inventory.updateOne(
        {
          _id: inventoryId,
          "inventoryGoods.supplierGoodId": supplierGoodId,
        },
        {
          $set: {
            "inventoryGoods.$[elem].dynamicSystemCount": currentCountQuantity,
            "inventoryGoods.$[elem].averageDeviationPercent":
              averageDeviationPercentCalculation,
          },
          $push: {
            "inventoryGoods.$[elem].monthlyCounts": newInventoryCount,
          },
        },
        {
          arrayFilters: [{ "elem.supplierGoodId": supplierGoodId }],
        }
      ),
    ]);

    return new NextResponse(
      JSON.stringify({ message: "Inventory count added!" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Updated inventory failed!", error);
  }
};

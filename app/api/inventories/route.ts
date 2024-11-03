import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import moment from "moment";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { updateDynamicCountSupplierGood } from "./utils/updateDynamicCountSupplierGood";

// imported interfaces
import { IInventory } from "@/app/lib/interface/IInventory";

// imported models
import Inventory from "@/app/lib/models/inventory";
import SupplierGood from "@/app/lib/models/supplierGood";
import Supplier from "@/app/lib/models/supplier";

// @desc    Get all inventories
// @route   GET /inventories
// @access  Private
export const GET = async (req: Request) => {
  try {
    // connect before first call to DB
    await connectDb();

    // Find inventories with the query
    const inventories = await Inventory.find()
      .populate({
        path: "inventoryGoods.supplierGoodId",
        select:
          "name mainCategory subCategory supplierId budgetImpact imageUrl inventorySchedule parLevel measurementUnit pricePerMeasurementUnit",
        model: SupplierGood,
        populate: {
          path: "supplierId",
          select: "tradeName",
          model: Supplier,
        },
      })
      .lean();

    return !inventories.length
      ? new NextResponse(JSON.stringify({ message: "No inventories found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(inventories), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get inventories failed!", error);
  }
};

// *** IMPORTANT ***
// this route is run only on the first day of the month
// if there is an inventory with the current month, it will do nothing, otherways from the first day of the month, when manager or admin login, the system will set the setFinalCount from previews inventory to "true" them create a new inventory with all the supplier goods in used
// @desc    Create a new inventory
// @route   POST /inventories
// @access  Private
export const POST = async (req: Request) => {
  // *** IMPORTANT ***
  // inventory will be created on the first day of the month, with all the supplier goods that exists on the business and are currently in use
  // from there, all the count will be handle as updates to the inventoryGoods.monthlyCounts array
  // *****************

  const { businessId } = (await req.json()) as { businessId: Types.ObjectId };

  // Validate businessId
  if (isObjectIdValid([businessId]) !== true) {
    return new NextResponse(
      JSON.stringify({ message: "Invalid business ID" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Get the current month's start and end dates
  const startOfCurrentMonth = moment().startOf("month").toDate();
  const endOfCurrentMonth = moment().endOf("month").toDate();

  // connect before first call to DB
  await connectDb();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // the code supose to run on the first day of the month
    // we are looking for a inventory with the current month that doesnt exists do we can close the previews inventory and create a new one
    const currentMonthInventory: IInventory | null = await Inventory.findOne({
      businessId: businessId,
      createdAt: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth },
    })
      .select("setFinalCount")
      .lean();

    if (currentMonthInventory) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({
          message: "Inventory for the current month already exists!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get the previous month's start and end dates
    const startOfPreviousMonth = moment()
      .subtract(1, "months")
      .startOf("month")
      .toDate();
    const endOfPreviousMonth = moment()
      .subtract(1, "months")
      .endOf("month")
      .toDate();

    // Fetch the previous month's inventory for the business
    const lastInventory: IInventory | null = await Inventory.findOneAndUpdate(
      {
        businessId: businessId,
        createdAt: { $gte: startOfPreviousMonth, $lte: endOfPreviousMonth },
      },
      {
        $set: { setFinalCount: true },
      },
      { new: true, session }
    ).lean();

    // *** IMPORTANT ***
    // we dont check if lastInventory is null because if it is the first inventory it will be null but the code keep running, the inventoryGoods will be created with the default values

    // Fetch all supplier goods for the business
    const supplierGoods = await SupplierGood.find({
      businessId: businessId,
      currentlyInUse: true,
    })
      .select("_id")
      .lean();

    // *** IMPORTANT ***
    // we also dont check if supplierGoods is null because once inventory can get created automatically before employee set the supplier goods

    // Create the inventoryGoods array
    const inventoryGoodsArr = supplierGoods.map((supplierGood: any) => {
      // Find if this supplierGood exists in the last inventory
      const lastInventoryGood = lastInventory?.inventoryGoods.find(
        (good) => good.supplierGoodId.toString() === supplierGood._id.toString()
      );

      // Determine dynamicSystemCount
      const dynamicSystemCount =
        lastInventoryGood && lastInventoryGood.monthlyCounts.length > 0
          ? lastInventoryGood.monthlyCounts.sort(
              (a, b) =>
                new Date(b.countedDate ?? "").getTime() -
                new Date(a.countedDate ?? "").getTime()
            )[0]?.currentCountQuantity || 0
          : 0; // Default count if no previous record

      return {
        supplierGoodId: supplierGood._id,
        monthlyCounts: [],
        dynamicSystemCount: dynamicSystemCount,
      };
    });

    // Create the inventory object
    const newInventory: IInventory = {
      businessId: businessId,
      setFinalCount: false,
      inventoryGoods: inventoryGoodsArr,
    };

    // Insert the new inventory
    // could also use [newInventory] instead of newInventory for highligting it is performing a bulk insert
    const createdInventory = await Inventory.create([newInventory], {
      session,
    });

    if (!createdInventory) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Failed to create inventory" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({ message: "Inventory created successfully" }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Create inventory failed!", error);
  } finally {
    session.endSession();
  }
};

// export const POST = async () => {
//   try {
//     let businessGoodsIds = [
//       "667bfc0c5d50be40f0c7b065",
//       "667bfddd5d50be40f0c7b079",
//       "667bfc0c5d50be40f0c7b065"
//   ];

//     let addOrRemove: "remove" | "add" = "remove";

//     // connect before first call to DB
//     await connectDb();

//     const result = await updateDynamicCountSupplierGood(
//       //@ts-ignore
//       businessGoodsIds,
//       addOrRemove
//     );

//     return new NextResponse(JSON.stringify(result), {
//       status: 200, // Change status to 200
//       headers: { "Content-Type": "application/json" },
//     });
//   } catch (error) {
//     return handleApiError("Create inventory failed!", error);
//   }
// };

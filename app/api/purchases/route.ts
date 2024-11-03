import mongoose, { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { validateInventoryPurchaseItems } from "./utils/validateInventoryPurchaseItems";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import oneTimePurchaseSupplier from "../suppliers/utils/oneTimePurchaseSupplier";

// imported interfaces
import { IPurchase, IPurchaseItem } from "@/app/lib/interface/IPurchase";

// imported models
import Inventory from "@/app/lib/models/inventory";
import SupplierGood from "@/app/lib/models/supplierGood";
import Supplier from "@/app/lib/models/supplier";
import Purchase from "@/app/lib/models/purchase";

// *** This is all the supplier goods that are purchased in a single purchase ***
// Also there is the option of one time purchase, where the employee can add a new supplier and the goods in the same form without the need to create a supplier first

// @desc    Get all purchases
// @route   GET /purchases?startDate=<date>&endDate=<date>
// @access  Private
export const GET = async (req: Request) => {
  try {
    // date and time will come from the front as ex: "2023-04-01T15:00:00", you can create a Date object from it with new Date(startDate). This will create a Date object representing midnight on the given date in the LOCAL TIME ZONE OF THE SERVER.
    // If you need to ensure that the date represents midnight in a specific time zone, you may need to use a library like Moment.js or date-fns that supports time zones. These libraries can parse the date string and create a Date object in a specific time zone.

    // Parse query parameters for optional date range
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build the query object
    const query: any = {};

    if (startDate && endDate) {
      if (startDate > endDate) {
        return new NextResponse(
          JSON.stringify({
            message: "Invalid date range, start date must be before end date!",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      } else {
        query.purchaseDate = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }
    }

    // connect before first call to DB
    await connectDb();

    const purchases = await Purchase.find(query)
      .populate({
        path: "supplierId",
        select: "tradeName",
        model: Supplier,
      })
      .populate({
        path: "purchaseInventoryItems.supplierGoodId",
        select:
          "name mainCategory subCategory measurementUnit pricePerMeasurementUnit",
        model: SupplierGood,
      })
      .lean();

    return !purchases?.length
      ? new NextResponse(JSON.stringify({ message: "No purchases found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(purchases), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get all purchases failed!", error);
  }
};

// ************ IMPORTANT ************
// 1 purchase can have multiple supplier goods but it is one purchase by receipt
// ***********************************

// @desc    Create new purchase
// @route   POST /purchases
// @access  Private
export const POST = async (req: Request) => {
  const {
    title,
    supplierId,
    purchaseDate,
    businessId,
    purchasedByEmployeeId,
    purchaseInventoryItems,
    receiptId,
    comment,
  } = (await req.json()) as IPurchase;

  // check required fields
  if (
    !supplierId ||
    !purchaseDate ||
    !businessId ||
    !purchasedByEmployeeId ||
    !purchaseInventoryItems ||
    !receiptId
  ) {
    return new NextResponse(
      JSON.stringify({
        message:
          "SupplierId, purchaseDate, businessId, purchasedByEmployeeId, purchaseInventoryItems and reciptId are required!",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  // check if ids are valid
  // we dont validate supplierId because it can be a string "One Time Purchase"
  if (!isObjectIdValid([businessId, purchasedByEmployeeId])) {
    return new NextResponse(
      JSON.stringify({
        message: "Business or employee IDs not valid!",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  // calculate the total amount of the purchase
  const totalAmount = purchaseInventoryItems.reduce(
    (acc: number, item: IPurchaseItem) => acc + item.purchasePrice,
    0
  );

  // get the default supplier id for one time purchase
  let newSupplierId: Types.ObjectId = supplierId;

  const newPurchaseInventoryItems = purchaseInventoryItems;

  if (supplierId.toString() === "One Time Purchase") {
    // comment is required for one time purchase
    if (!comment) {
      return new NextResponse(
        JSON.stringify({
          message: "Comment is required for one time purchase!",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // ***** IMPORTANTE *****
    // one time purcahse are not updated on inventory because supplier goods does not exists
    //it supose to be used on very rare ocasions or never
    // best approach is to create a supplier and goods before the purchase and set the supplier good to the business good ingredients that apply
    let createOneTimePurchaseSupplierResult = await oneTimePurchaseSupplier(
      businessId
    );

    // check if new supplier ids is valid
    if (!isObjectIdValid([createOneTimePurchaseSupplierResult])) {
      return new NextResponse(
        JSON.stringify({
          message: "SupplierId not valid!",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }
    newSupplierId = createOneTimePurchaseSupplierResult;

    newPurchaseInventoryItems.forEach((item: any) => {
      item.supplierGoodId = newSupplierId;
    });
  }

  const isOneTimePurchase =
    supplierId.toString() === "One Time Purchase" ? true : false;

  // Validate purchase items structure
  const arePurchaseItemsValid = validateInventoryPurchaseItems(
    purchaseInventoryItems,
    isOneTimePurchase
  );
  if (arePurchaseItemsValid !== true) {
    return new NextResponse(
      JSON.stringify({
        message: "Purchase items array of objects not valid!",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  // connect before first call to DB or start transaction
  await connectDb();

  // start transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // check if receiptId already exists
    const existingReceiptId = await Purchase.exists({
      receiptId: receiptId,
      businessId: businessId,
      supplierId: newSupplierId,
    });
    if (existingReceiptId) {
      await session.abortTransaction;
      return new NextResponse(
        JSON.stringify({ message: "Receipt Id already exists!" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const newPurchase = {
      title: title ? title : "Purchase without title!",
      supplierId: newSupplierId,
      purchaseDate,
      businessId,
      purchasedByEmployeeId,
      purchaseInventoryItems: newPurchaseInventoryItems,
      oneTimePurchase: isOneTimePurchase,
      totalAmount,
      receiptId: receiptId,
      comment: comment ? comment : undefined,
    };

    const newPurchaseResult = await Purchase.create([newPurchase], { session });

    if (!newPurchaseResult) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Purchase creation failed!" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Update inventory with the new purchase items
    // Create a batch update operation to update inventoryGoods
    const bulkOperations = newPurchaseInventoryItems.map(
      (item: IPurchaseItem) => {
        const { supplierGoodId, quantityPurchased } = item;
        return {
          updateOne: {
            filter: {
              businessId: businessId,
              "inventoryGoods.supplierGoodId": supplierGoodId,
              setFinalCount: false,
            },
            update: {
              $inc: {
                "inventoryGoods.$.dynamicSystemCount": quantityPurchased,
              },
            },
          },
        };
      }
    );

    // Perform bulk write operation to update inventory
    const bulkResult = await Inventory.bulkWrite(bulkOperations, { session });

    if (bulkResult.ok !== 1) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({
          message: "Inventory not found or bulk update failed.",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Commit the transaction if both operations succeed
    await session.commitTransaction();

    // Return success response
    return new NextResponse(
      JSON.stringify({ message: "Purchase created and inventory updated" }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Create new purchase failed!", error);
  } finally {
    session.endSession();
  }
};

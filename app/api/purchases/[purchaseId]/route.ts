import mongoose, { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Purchase from "@/app/lib/models/purchase";
import Supplier from "@/app/lib/models/supplier";
import SupplierGood from "@/app/lib/models/supplierGood";
import { IPurchase } from "@/app/lib/interface/IPurchase";
import Inventory from "@/app/lib/models/inventory";

// @desc    GET purchase by ID
// @route   GET /purchases/:purchaseId?startDate=<date>&endDate=<date>
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { purchaseId: Types.ObjectId } }
) => {
  try {
    const purchaseId = context.params.purchaseId;

    // check if the purchaseId is a valid ObjectId
    if (isObjectIdValid([purchaseId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Purchase ID not valid!" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    const purchase = await Purchase.findById(purchaseId)
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

    return !purchase
      ? new NextResponse(JSON.stringify({ message: "Purchase not found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(purchase), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get purchase by id failed!", error);
  }
};

// updates on the PURCHASEINVENTORYITEMS are not been done here, we got separate route for that
// @desc    Update purchase by ID
// @route   PUT /purchases/:purchaseId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { purchaseId: Types.ObjectId } }
) => {
  const purchaseId = context.params.purchaseId;

  const { title, purchaseDate, businessId, purchasedByEmployeeId, receiptId } =
    (await req.json()) as IPurchase;

  // businessId is required
  if (!businessId) {
    return new NextResponse(
      JSON.stringify({ message: "Business ID is required!" }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  // check if ids are valid
  if (isObjectIdValid([businessId, purchasedByEmployeeId]) !== true) {
    return new NextResponse(
      JSON.stringify({
        message: "Supplier, business or employee IDs not valid!",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  try {
    // connect before first call to DB
    await connectDb();

    // check if new receiptId already exists
    if (receiptId) {
      const existingReceiptId = await Purchase.exists({
        id: { $ne: purchaseId },
        receiptId: receiptId,
        businessId: businessId,
      });
      if (existingReceiptId) {
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
    }

    // Prepare the fields that need to be updated
    const updatePurchaseObj: Partial<IPurchase> = {};

    if (title) updatePurchaseObj.title = title;
    if (purchaseDate) updatePurchaseObj.purchaseDate = purchaseDate;
    if (purchasedByEmployeeId)
      updatePurchaseObj.purchasedByEmployeeId = purchasedByEmployeeId;
    if (receiptId) updatePurchaseObj.receiptId = receiptId;

    // Update the purchase in a single query
    const updatedPurchase = await Purchase.findByIdAndUpdate(
      purchaseId,
      { $set: updatePurchaseObj },
      { new: true, lean: true } // Use lean to reduce memory footprint after updating
    );

    // Check if the purchase was found and updated
    if (!updatedPurchase) {
      return new NextResponse(
        JSON.stringify({ message: "Purchase not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: "Purchase updated successfully!",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Update purchase failed!", error);
  }
};

// delete an purchase shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where an purchase should be deleted is if the business itself is deleted
// @desc    Delete purchase by ID
// @route   DELETE /purchases/:purchaseId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { purchaseId: Types.ObjectId } }
) => {
  const purchaseId = context.params.purchaseId;

  // check if the purchaseId is a valid ObjectId
  if (!isObjectIdValid([purchaseId])) {
    return new NextResponse(
      JSON.stringify({ message: "Purchase ID not valid!" }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  // connect before first call to DB
  await connectDb();

  // start session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // get the purchase to get its businessId and supplierGoodId
    const purchase: IPurchase | null = await Purchase.findById(purchaseId)
      .select("businessId purchaseInventoryItems")
      .lean();

    if (!purchase) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Purchase not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // delete purchase and check if it existed
    const result = await Purchase.deleteOne({
      _id: purchaseId,
    }).session(session);

    if (result.deletedCount === 0) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Purchase not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // create bulk write operations to update the inventory
    const bulkWriteOperations = purchase.purchaseInventoryItems?.map((item) => {
      return {
        updateOne: {
          filter: {
            businessId: purchase.businessId,
            setFinalCount: false,
            "inventoryGoods.supplierGoodId": item.supplierGoodId,
          },
          update: {
            $inc: {
              "inventoryGoods.$.dynamicSystemCount": -item.quantityPurchased,
            },
          },
        },
      };
    });

    // update the inventory
    if (bulkWriteOperations && bulkWriteOperations.length > 0) {
      const updatedInventory = await Inventory.bulkWrite(bulkWriteOperations, {
        session,
      });

      if (updatedInventory.ok !== 1) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: "Inventory update failed!" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Commit transaction
    await session.commitTransaction();

    return new NextResponse(`Purchase ${purchaseId} deleted`, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Delete purchase failed!", error);
  } finally {
    session.endSession();
  }
};

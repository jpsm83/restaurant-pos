import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";

// imported utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";

// imported interfaces
import { IPurchase } from "@shared/interfaces/IPurchase";

// imported models
import Purchase from "@/lib/db/models/purchase";
import Inventory from "@/lib/db/models/inventory";

// this route is to delete a supplierGood from the purchase that already exists
// @desc    Delete supplierGood from purchase by ID
// @route   PATCH /purchases/:purchaseId/deleteSupplierGoodFromPurchase
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { purchaseId: Types.ObjectId } }
) => {
  const purchaseId = context.params.purchaseId;

  const { purchaseInventoryItemsId } = await req.json();

  // check if the purchaseId is a valid ObjectId
  if (isObjectIdValid([purchaseId]) !== true) {
    return new NextResponse(
      JSON.stringify({ message: "Purchase or supplier ID not valid!" }),
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

  // start the transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // get the purchase purchaseItem for inventory update
    const purchaseItem = (await Purchase.findOne(
      {
        _id: purchaseId,
        "purchaseInventoryItems._id": purchaseInventoryItemsId,
      },
      {
        businessId: 1,
        "purchaseInventoryItems.$": 1, // Only retrieve the matching inventory item
      }
    ).lean()) as unknown as IPurchase | null;

    if (!purchaseItem) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Purchase item not found!" }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const quantityPurchased =
      purchaseItem?.purchaseInventoryItems?.[0].quantityPurchased ?? 0;

    const [updatePurchase, updatedInventory] = await Promise.all([
      // delete supplierGood from purchase
      Purchase.findOneAndUpdate(
        {
          _id: purchaseId,
        },
        {
          $pull: { purchaseInventoryItems: { _id: purchaseInventoryItemsId } },
          $inc: { totalAmount: -quantityPurchased },
        },
        { new: true, lean: true, session }
      ).select("businessId"),

      // Update the inventory based on the deleted purchase items
      Inventory.findOneAndUpdate(
        {
          businessId: purchaseItem.businessId,
          "inventoryGoods.supplierGoodId":
            purchaseItem?.purchaseInventoryItems?.[0].supplierGoodId,
          setFinalCount: false,
        },
        {
          $inc: {
            "inventoryGoods.$.dynamicSystemCount": -quantityPurchased,
          },
        },
        { new: true, lean: true, session }
      ),
    ]);

    if (!updatePurchase) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "SupplierGood not found or delete failed!" }),
        { status: 404 }
      );
    }

    if (!updatedInventory) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({
          message: "Inventory not found or update failed.",
        }),
        { status: 404 }
      );
    }

    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({
        message: "SupplierGood added to purchase successfully!",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Add supplierGood to purchase failed!", error);
  } finally {
    session.endSession();
  }
};

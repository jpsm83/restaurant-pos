import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported interfaces
import { IPurchase } from "@/app/lib/interface/IPurchase";

// imported models
import Purchase from "@/app/lib/models/purchase";
import Inventory from "@/app/lib/models/inventory";

// this route is to edit a supplierGood from the purchase that already exists
// @desc    Edit supplierGood from purchase by ID
// @route   PATCH /purchases/:purchaseId/editSupplierGoodFromPurchase
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { purchaseId: Types.ObjectId } }
) => {
  const purchaseId = context.params.purchaseId;

  const { purchaseInventoryItemsId, newQuantityPurchased, newPurchasePrice } =
    await req.json();

  // check if the purchaseId is a valid ObjectId
  if (isObjectIdValid([purchaseId, purchaseInventoryItemsId]) !== true) {
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
    const purchaseItem: IPurchase | null = await Purchase.findOne(
      {
        _id: purchaseId,
        "purchaseInventoryItems._id": purchaseInventoryItemsId,
      },
      {
        businessId: 1,
        "purchaseInventoryItems.$": 1, // Only retrieve the matching inventory item
      }
    ).lean();

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

    const previousQuantity =
      purchaseItem?.purchaseInventoryItems?.[0].quantityPurchased ?? 0;
    const previousPrice =
      purchaseItem?.purchaseInventoryItems?.[0].purchasePrice ?? 0;

    const [updatePurchase, updatedInventory] = await Promise.all([
      // Update the purchaseItem with the new values
      await Purchase.findOneAndUpdate(
        {
          _id: purchaseId,
          "purchaseInventoryItems._id": purchaseInventoryItemsId,
        },
        {
          $set: {
            "purchaseInventoryItems.$.quantityPurchased": newQuantityPurchased,
            "purchaseInventoryItems.$.purchasePrice": newPurchasePrice,
          },
          $inc: {
            totalAmount: newPurchasePrice - previousPrice,
          },
        },
        { new: true, lean: true, session }
      ).select("businessId"),

      // Update the inventory based on new purchase items
      Inventory.findOneAndUpdate(
        {
          businessId: purchaseItem.businessId,
          "inventoryGoods.supplierGoodId":
            purchaseItem?.purchaseInventoryItems?.[0].supplierGoodId,
          setFinalCount: false,
        },
        {
          $inc: {
            "inventoryGoods.$.dynamicSystemCount":
              newQuantityPurchased - previousQuantity,
          },
        },
        { new: true, lean: true, session }
      ),
    ]);

    if (!updatePurchase) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Purchase not found!" }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        }
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

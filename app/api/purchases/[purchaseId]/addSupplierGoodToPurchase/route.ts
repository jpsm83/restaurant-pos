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

// this route is to add a supplierGood to the purchase that already exists
// @desc    Add supplierGood to purchase by ID
// @route   PATCH /purchases/:purchaseId/addSupplierGoodToPurchase
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { purchaseId: Types.ObjectId } }
) => {
  const purchaseId = context.params.purchaseId;

  const { supplierGoodId, quantityPurchased, purchasePrice } = await req.json();

  // check if the purchaseId is a valid ObjectId
  if (isObjectIdValid([supplierGoodId]) !== true) {
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
    const updatePurchase: IPurchase | null = await Purchase.findOneAndUpdate(
      { _id: purchaseId },
      {
        $push: {
          purchaseInventoryItems: {
            supplierGoodId: supplierGoodId,
            quantityPurchased: quantityPurchased,
            purchasePrice: purchasePrice,
          },
        },
        $inc: { totalAmount: purchasePrice },
      },
      { new: true, session }
    ).lean();

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

    // update inventory with the new purchase items
    const updatedInventory = await Inventory.findOneAndUpdate(
      {
        businessId: updatePurchase.businessId,
        "inventoryGoods.supplierGoodId": supplierGoodId,
        setFinalCount: false,
      },
      {
        $inc: {
          "inventoryGoods.$.dynamicSystemCount": quantityPurchased,
        },
      },
      { new: true, lean: true, session }
    );

    if (!updatedInventory) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({
          message: "Inventory not found or update failed.",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
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

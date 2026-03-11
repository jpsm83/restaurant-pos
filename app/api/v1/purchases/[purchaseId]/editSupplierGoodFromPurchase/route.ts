import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";

import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import { MANAGEMENT_ROLES } from "@/lib/constants";
import { IPurchase } from "@/lib/interface/IPurchase";
import { IEmployee } from "@/lib/interface/IEmployee";
import Purchase from "@/lib/db/models/purchase";
import Inventory from "@/lib/db/models/inventory";
import Employee from "@/lib/db/models/employee";

// Edit supplier good line on a purchase (manager-only, with reason)
// @desc    Edit supplierGood from purchase by ID
// @route   PATCH /purchases/:purchaseId/editSupplierGoodFromPurchase
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { purchaseId: Types.ObjectId } }
) => {
  const purchaseId = context.params.purchaseId;

  const {
    purchaseInventoryItemsId,
    newQuantityPurchased,
    newPurchasePrice,
    editedByEmployeeId,
    reason,
  } = (await req.json()) as {
    purchaseInventoryItemsId: Types.ObjectId;
    newQuantityPurchased: number;
    newPurchasePrice: number;
    editedByEmployeeId: Types.ObjectId;
    reason: string;
  };

  if (
    !editedByEmployeeId ||
    !reason ||
    typeof reason !== "string" ||
    reason.trim() === ""
  ) {
    return new NextResponse(
      JSON.stringify({
        message: "editedByEmployeeId and reason (non-empty) are required!",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (
    isObjectIdValid([purchaseId, purchaseInventoryItemsId, editedByEmployeeId]) !==
    true
  ) {
    return new NextResponse(
      JSON.stringify({ message: "Purchase or supplier or employee ID not valid!" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  await connectDb();

  const employee = await Employee.findById(editedByEmployeeId)
    .select("currentShiftRole onDuty businessId")
    .lean() as IEmployee | null;

  if (
    !employee ||
    !MANAGEMENT_ROLES.includes(employee.currentShiftRole ?? "") ||
    !employee.onDuty
  ) {
    return new NextResponse(
      JSON.stringify({
        message: "You are not allowed to edit purchase lines!",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // start the transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
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

    const previousQuantity =
      purchaseItem?.purchaseInventoryItems?.[0].quantityPurchased ?? 0;
    const previousPrice =
      purchaseItem?.purchaseInventoryItems?.[0].purchasePrice ?? 0;

    if (purchaseItem.businessId && employee.businessId?.toString() !== purchaseItem.businessId.toString()) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Purchase does not belong to your business!" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    const [updatePurchase, updatedInventory] = await Promise.all([
      Purchase.findOneAndUpdate(
        {
          _id: purchaseId,
          "purchaseInventoryItems._id": purchaseInventoryItemsId,
        },
        {
          $set: {
            "purchaseInventoryItems.$.quantityPurchased": newQuantityPurchased,
            "purchaseInventoryItems.$.purchasePrice": newPurchasePrice,
            "purchaseInventoryItems.$.lastEditByEmployeeId": editedByEmployeeId,
            "purchaseInventoryItems.$.lastEditReason": reason.trim(),
            "purchaseInventoryItems.$.lastEditDate": now,
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
        message: "Supplier good line updated successfully!",
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
    return handleApiError(
      "Add supplierGood to purchase failed!",
      error instanceof Error ? error.message : String(error)
    );
  } finally {
    session.endSession();
  }
};

import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { getToken } from "next-auth/jwt";

import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import { MANAGEMENT_ROLES } from "@/lib/constants";
import { IPurchase } from "@shared/interfaces/IPurchase";
import { IEmployee } from "@shared/interfaces/IEmployee";
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

  const { purchaseInventoryItemsId, newQuantityPurchased, newPurchasePrice, reason } =
    (await req.json()) as {
      purchaseInventoryItemsId: Types.ObjectId;
      newQuantityPurchased: number;
      newPurchasePrice: number;
      reason: string;
    };

  if (!reason || typeof reason !== "string" || reason.trim() === "") {
    return new NextResponse(
      JSON.stringify({
        message: "reason (non-empty) is required!",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (
    isObjectIdValid([purchaseId, purchaseInventoryItemsId]) !== true
  ) {
    return new NextResponse(
      JSON.stringify({ message: "Purchase or supplier ID not valid!" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const token = await getToken({
    req: req as Parameters<typeof getToken>[0]["req"],
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.id || token.type !== "user") {
    return new NextResponse(
      JSON.stringify({ message: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  const userId = new Types.ObjectId(token.id as string);

  await connectDb();

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

  const businessId =
    typeof purchaseItem.businessId === "object" &&
    purchaseItem.businessId !== null &&
    "_id" in purchaseItem.businessId
      ? (purchaseItem.businessId as { _id: Types.ObjectId })._id
      : (purchaseItem.businessId as Types.ObjectId);

  const employee = (await Employee.findOne({
    userId,
    businessId,
  })
    .select("_id currentShiftRole businessId")
    .lean()) as IEmployee | null;

  if (
    !employee ||
    !MANAGEMENT_ROLES.includes(employee.currentShiftRole ?? "")
  ) {
    return new NextResponse(
      JSON.stringify({
        message: "You are not allowed to edit purchase lines!",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  if (
    purchaseItem.businessId &&
    employee.businessId?.toString() !== purchaseItem.businessId.toString()
  ) {
    return new NextResponse(
      JSON.stringify({ message: "Purchase does not belong to your business!" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // start the transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const previousQuantity =
      purchaseItem?.purchaseInventoryItems?.[0].quantityPurchased ?? 0;
    const previousPrice =
      purchaseItem?.purchaseInventoryItems?.[0].purchasePrice ?? 0;

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
            "purchaseInventoryItems.$.lastEditByEmployeeId": employee._id,
            "purchaseInventoryItems.$.lastEditReason": reason.trim(),
            "purchaseInventoryItems.$.lastEditDate": now,
            "purchaseInventoryItems.$.lastEditOriginalQuantity": previousQuantity,
            "purchaseInventoryItems.$.lastEditOriginalPrice": previousPrice,
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

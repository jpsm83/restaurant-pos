import { NextResponse } from "next/server";
import { Types } from "mongoose";

// imported utils
import connectDb from "@/lib/db/connectDb";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import { handleApiError } from "@/lib/db/handleApiError";

// imported models
import BusinessGood from "@/lib/db/models/businessGood";
import SupplierGood from "@/lib/db/models/supplierGood";

// @desc    Get business goods by business ID
// @route   GET /businessGoods/business/:businessId
// @access  Private
export const GET = async (
  req: Request,
  context: {
    params: { businessId: Types.ObjectId };
  }
) => {
  try {
    const businessId = context.params.businessId; // Corrected to use route parameter

    if (isObjectIdValid([businessId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    const businessGoods = await BusinessGood.find({ businessId: businessId })
      .populate({
        path: "ingredients.supplierGoodId",
        select: "name mainCategory subCategory",
        model: SupplierGood,
      })
      .populate({
        path: "setMenuIds",
        select: "name mainCategory subCategory sellingPrice",
        model: SupplierGood,
      })
      .lean();

    return !businessGoods.length
      ? new NextResponse(
          JSON.stringify({ message: "No business goods found!" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
      : new NextResponse(JSON.stringify(businessGoods), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get business good by business id failed!", error);
  }
};

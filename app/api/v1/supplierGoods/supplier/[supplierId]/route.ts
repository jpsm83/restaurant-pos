import { NextResponse } from "next/server";
import { Types } from "mongoose";

// imported utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";

// import models
import SupplierGood from "@/lib/db/models/supplierGood";

// @desc    Get supplier goods by supplier ID
// @route   GET /supplierGoods/supplier/:supplierId
// @access  Private
export const GET = async (
  req: Request,
  context: {
    params: { supplierId: Types.ObjectId };
  }
) => {
  try {
    const supplierId = context.params.supplierId;

    // check if the supplier is valid
    if (!isObjectIdValid([supplierId])) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid supplierId!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDb();

    const supplierGoods = await SupplierGood.find({
      supplierId: supplierId,
    }).lean();

    return !supplierGoods.length
      ? new NextResponse(
          JSON.stringify({ message: "No supplier goods found!" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
      : new NextResponse(JSON.stringify(supplierGoods), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get supplier good by supplier id failed!", error);
  }
};

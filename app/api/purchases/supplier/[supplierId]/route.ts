import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Purchase from "@/app/lib/models/purchase";
import Supplier from "@/app/lib/models/supplier";
import SupplierGood from "@/app/lib/models/supplierGood";

// @desc    GET purchase by ID
// @route   GET /purchases/supplier/:supplierId?startDate=<date>&endDate=<date>
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { supplierId: Types.ObjectId } }
) => {
  try {
    const supplierId = context.params.supplierId;

    // check if the supplierId is a valid ObjectId
    if (!isObjectIdValid([supplierId])) {
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

    // date and time will como from the front as ex: "2023-04-01T15:00:00", you can create a Date object from it with new Date(startDate). This will create a Date object representing midnight on the given date in the LOCAL TIME ZONE OF THE SERVER.
    // If you need to ensure that the date represents midnight in a specific time zone, you may need to use a library like Moment.js or date-fns that supports time zones. These libraries can parse the date string and create a Date object in a specific time zone.

    // Parse query parameters for optional date range
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build query based on the presence of startDate and endDate
    let query: {
      supplierId: Types.ObjectId;
      purchaseDate?: {
        $gte: Date;
        $lte: Date;
      };
    } = { supplierId: supplierId };

    // Build the query object with the optional date range
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
      }
      query.purchaseDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }
    
    // connect before first call to DB
    await connectDb();

    const purchase = await Purchase.find(query)
      .populate({
        path: "supplierId",
        select: "tradeName",
        model: Supplier,
      })
      .populate({
        path: "purchaseInventoryItems.supplierGoodId",
        select: "name mainCategory subCategory measurementUnit pricePerMeasurementUnit",
        model: SupplierGood,
      })
      .lean();

    return !purchase || purchase.length === 0
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

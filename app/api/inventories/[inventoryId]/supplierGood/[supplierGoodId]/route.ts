import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Inventory from "@/app/lib/models/inventory";
import SupplierGood from "@/app/lib/models/supplierGood";
import Supplier from "@/app/lib/models/supplier";

// get the inventories of an especifc supplierGood ID and the month needed
// @desc    Get inventories by supplierGood ID and range of dates
// @route   GET /inventories/:inventoryId/supplierGood/:supplierGoodId?monthDate=<monthDate>
// @access  Private
export const GET = async (
  req: Request,
  context: {
    params: { inventoryId: Types.ObjectId; supplierGoodId: Types.ObjectId };
  }
) => {
  const { inventoryId, supplierGoodId } = context.params;

  // check if the businessId is valid
  if (!isObjectIdValid([inventoryId, supplierGoodId])) {
    return new NextResponse(
      JSON.stringify({ message: "Inventory or supplier good ID not valid!" }),
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
  const monthDateParams = searchParams.get("monthDate");

  // Initialize startDate and endDate
  let startDate = monthDateParams ? new Date(monthDateParams) : null;
  let endDate = monthDateParams ? new Date(monthDateParams) : null;

  // Set startDate to the first day of the month if provided
  if (startDate) {
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
  }

  // Set endDate to the last day of the month if provided
  if (endDate) {
    endDate = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
    endDate.setHours(23, 59, 59, 999);
  }

  // Build query based on the presence of startDate and endDate
  let query: {
    _id: Types.ObjectId;
    "inventoryGoods.supplierGoodId": Types.ObjectId;
    createdAt?: {
      $gte: Date;
      $lte: Date;
    };
  } = { _id: inventoryId, "inventoryGoods.supplierGoodId": supplierGoodId };

  // Build the query object with the optional date range
  if (startDate && endDate) {
    query.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  try {
    // connect before first call to DB
    await connectDb();

    // Find inventories with the query
    const inventories = await Inventory.find(query)
      .select("inventoryGoods.$")
      .populate({
        path: "inventoryGoods.supplierGoodId",
        select:
          "name mainCategory subCategory supplierId budgetImpact imageUrl inventorySchedule parLevel measurementUnit pricePerMeasurementUnit",
        model: SupplierGood,
        populate: {
          path: "supplierId",
          select: "tradeName",
          model: Supplier,
        },
      })
      .lean();

    return !inventories.length
      ? new NextResponse(JSON.stringify({ message: "No inventories found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(inventories), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get inventories by business id failed!", error);
  }
};

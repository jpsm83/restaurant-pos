import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";

// imported models
import Purchase from "@/lib/db/models/purchase";
import Supplier from "@/lib/db/models/supplier";
import SupplierGood from "@/lib/db/models/supplierGood";
import Employee from "@/lib/db/models/employee";

// @desc    GET purchases by user (resolves user to employee(s), then finds purchases recorded by those employees)
// @route   GET /purchases/user/:userId?startDate=<date>&endDate=<date>
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { userId: Types.ObjectId } }
) => {
  try {
    const userId = context.params.userId;

    if (!isObjectIdValid([userId])) {
      return new NextResponse(
        JSON.stringify({ message: "User ID not valid!" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    await connectDb();
    const employees = await Employee.find({ userId }).select("_id").lean();
    const employeeIds = employees.map((e) => e._id as Types.ObjectId);
    if (employeeIds.length === 0) {
      return new NextResponse(JSON.stringify({ message: "Purchase not found!" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const query: {
      purchasedByEmployeeId: { $in: Types.ObjectId[] };
      purchaseDate?: {
        $gte: Date;
        $lte: Date;
      };
    } = { purchasedByEmployeeId: { $in: employeeIds } };

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

    const purchase = await Purchase.find(query)
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
    return handleApiError("Get purchase by id failed!", error as string);
  }
};

import { Types } from "mongoose";
import { NextResponse } from "next/server";

import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import { getVarianceReport } from "../../../utils/getVarianceReport";
import SupplierGood from "@/lib/db/models/supplierGood";

// @desc    Get variance report (theoretical vs actual usage) per supplier good for a month
// @route   GET /api/v1/inventories/business/:businessId/varianceReport?month=YYYY-MM
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { businessId: Types.ObjectId } }
) => {
  const businessId = context.params.businessId;
  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month");

  if (isObjectIdValid([businessId]) !== true) {
    return new NextResponse(
      JSON.stringify({ message: "Business ID is not valid!" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let year: number;
  let month: number;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    if (m < 1 || m > 12) {
      return new NextResponse(
        JSON.stringify({ message: "Month must be 01-12." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    year = y;
    month = m;
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  try {
    await connectDb();

    const report = await getVarianceReport(businessId, year, month);

    const supplierGoodIds = report.map((r) => r.supplierGoodId);
    const supplierGoods = (await SupplierGood.find({
      _id: { $in: supplierGoodIds },
    })
      .select("name measurementUnit")
      .lean()) as { _id: Types.ObjectId; name?: string; measurementUnit?: string }[];

    const sgMap = new Map<
      string,
      { _id: Types.ObjectId; name?: string; measurementUnit?: string }
    >(
      supplierGoods.map((sg) => [
        sg._id.toString(),
        sg,
      ])
    );

    const payload = report.map((r) => ({
      ...r,
      supplierGoodName: sgMap.get(String(r.supplierGoodId))?.name,
    }));

    return new NextResponse(JSON.stringify({ varianceReport: payload }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return handleApiError(
      "Variance report failed!",
      error instanceof Error ? error.message : String(error)
    );
  }
};

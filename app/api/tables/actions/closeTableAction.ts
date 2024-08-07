import connectDB from "@/app/lib/db";
import { ITable } from "@/app/lib/interface/ITable";
import Order from "@/app/lib/models/order";
import Table from "@/app/lib/models/table";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { Types } from "mongoose";
import { NextResponse } from "next/server";

// @desc    Create new tables
// @route   POST /tables/actions
// @access  Private
export const POST = async (req: Request) => {
  try {
    const { tableId, closedBy } = (await req.json()) as {
      tableId: Types.ObjectId;
      closedBy: Types.ObjectId;
    };
    // connect before first call to DB
    await connectDB();

    // get all orders from the table
    const tableOrders: ITable[] | null = await Order.find({ table: tableId })
      .select("billingStatus")
      .lean();

    // if no orders, delete the table
    if (!tableOrders || tableOrders?.length === 0) {
      await Table.deleteOne({ _id: tableId });
      return new NextResponse(
        JSON.stringify({
          message: "Table with no orders deleted successfully",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // check if any order billingStatus is Open
    const hasOpenOrders = tableOrders.some(
      (order) => order.billingStatus === "Open"
    );

    // if no open orders and closeBy exists, close the table
    if (!hasOpenOrders && closedBy) {
      await Table.findByIdAndUpdate(
        tableId,
        {
          status: "Closed",
          closedAt: new Date(),
          closedBy,
        },
        { new: true }
      );
      return new NextResponse(
        JSON.stringify({ message: "Table closed successfully" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new NextResponse(
      JSON.stringify({
        message: "Table cant be closed because it still having open orders",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Close table failed!", error);
  }
};

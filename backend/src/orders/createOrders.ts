import { ClientSession, Types } from "mongoose";
import type { IOrder } from "@shared/interfaces/IOrder";
import type { ISalesInstance } from "@shared/interfaces/ISalesInstance";
import Order from "../models/order.js";
import SalesInstance from "../models/salesInstance.js";
import Reservation from "../models/reservation.js";
import { updateDynamicCountSupplierGood } from "../inventories/updateDynamicCountSupplierGood.js";

export async function createOrders(
  dailyReferenceNumber: string,
  ordersArr: Partial<IOrder>[],
  createdByUserId: Types.ObjectId | undefined,
  createdAsRole: "employee" | "customer" | undefined,
  salesInstanceId: Types.ObjectId,
  businessId: Types.ObjectId,
  session: ClientSession
): Promise<unknown[] | string> {
  try {
    if (createdByUserId && createdAsRole === "employee") {
      const salesInstance = (await SalesInstance.findById(salesInstanceId)
        .select("salesInstanceStatus")
        .lean()) as unknown as ISalesInstance | null;

      if (!salesInstance || salesInstance.salesInstanceStatus === "Closed") {
        return "SalesInstance not found or closed!";
      }
    }

    const ordersToInsert = ordersArr.map((order) => ({
      dailyReferenceNumber,
      billingStatus: "Open",
      orderStatus: "Sent",
      createdByUserId: createdByUserId || undefined,
      createdAsRole: createdAsRole || undefined,
      salesInstanceId,
      businessId,
      orderGrossPrice: order.orderGrossPrice,
      orderNetPrice: order.orderNetPrice,
      orderCostPrice: order.orderCostPrice,
      businessGoodId: order.businessGoodId,
      addOns: order.addOns ?? undefined,
      allergens: order.allergens || undefined,
      promotionApplyed: order.promotionApplyed || undefined,
      comments: order.comments || undefined,
      discountPercentage: order.discountPercentage || undefined,
    }));

    const ordersCreated = await Order.insertMany(ordersToInsert, { session });
    if (!ordersCreated || ordersCreated.length === 0) return "Orders not created!";

    const ordersIdsCreated = ordersCreated.map((order) => order._id);
    const businessGoodsIds = ordersCreated.flatMap((order) => [
      order.businessGoodId,
      ...(order.addOns ?? []),
    ]);

    const updateResult = await updateDynamicCountSupplierGood(
      businessGoodsIds,
      "remove",
      session
    );
    if (updateResult !== true) {
      return "updateDynamicCountSupplierGood failed! Error: " + updateResult;
    }

    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const day = String(new Date().getDate()).padStart(2, "0");
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const dayOfWeek = weekDays[new Date().getDay()];
    const randomNum = String(Math.floor(Math.random() * 9000) + 1000);
    const orderCode = `${day}${month}${dayOfWeek}${randomNum}`;

    const updatedSalesInstance = await SalesInstance.updateOne(
      { _id: salesInstanceId },
      {
        $push: {
          salesGroup: { orderCode, ordersIds: ordersIdsCreated, createdAt: new Date() },
        },
      },
      { session }
    );

    if (updatedSalesInstance.modifiedCount === 0) return "SalesInstance not updated!";

    const reservation = (await Reservation.findOne({
      salesInstanceId,
      status: { $in: ["Arrived", "Seated", "Confirmed"] },
    })
      .select("_id")
      .session(session)
      .lean()) as unknown as { _id: Types.ObjectId } | null;

    if (reservation) {
      await Promise.all([
        SalesInstance.updateOne(
          { _id: salesInstanceId, reservationId: { $exists: false } },
          { $set: { reservationId: reservation._id } },
          { session }
        ),
        Reservation.updateOne(
          { _id: reservation._id },
          { $set: { status: "Seated" } },
          { session }
        ),
      ]);
    }

    return ordersCreated;
  } catch (error) {
    return "Create order failed! Error: " + (error instanceof Error ? error.message : String(error));
  }
}


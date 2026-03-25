import { ClientSession, Types } from "mongoose";
import type { IOrder } from "../../../packages/interfaces/IOrder.ts";
import type { ISalesInstance } from "../../../packages/interfaces/ISalesInstance.ts";
import Order from "../models/order.ts";
import SalesInstance from "../models/salesInstance.ts";
import SalesPoint from "../models/salesPoint.ts";
import Reservation from "../models/reservation.ts";
import updateDynamicCountSupplierGood from "../inventories/updateDynamicCountSupplierGood.ts";

const createOrders = async (
  dailyReferenceNumber: string,
  ordersArr: Partial<IOrder>[],
  createdByUserId: Types.ObjectId | undefined,
  createdAsRole: "employee" | "customer" | undefined,
  salesInstanceId: Types.ObjectId,
  businessId: Types.ObjectId,
  session: ClientSession
): Promise<unknown[] | string> => {
  try {
    // Idea doc §5/§6: orders must always validate that the target SalesInstance
    // exists, is not closed, and belongs to the provided businessId.
    // This applies to both employee-served and customer/self-order/delivery flows.
    const salesInstance = (await SalesInstance.findOne({
      _id: salesInstanceId,
      businessId,
    })
      .select("salesInstanceStatus salesPointId")
      .lean()) as unknown as Pick<
      ISalesInstance,
      "salesInstanceStatus" | "salesPointId"
    > | null;

    if (!salesInstance) {
      return "SalesInstance not found for this business!";
    }

    if (salesInstance.salesInstanceStatus === "Closed") {
      return "SalesInstance is closed!";
    }

    // Ensure the SalesPoint backing the instance also belongs to the business.
    const salesPointOk = await SalesPoint.exists({
      _id: salesInstance.salesPointId,
      businessId,
    });

    if (!salesPointOk) {
      return "SalesPoint not found for this business!";
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

    // Idea doc §9: each createOrders(...) call represents a batch of orders.
    // Each batch gets its own `orderCode` inside its own `salesGroup` block.
    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const day = String(new Date().getDate()).padStart(2, "0");
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const dayOfWeek = weekDays[new Date().getDay()];
    const randomNum = String(Math.floor(Math.random() * 9000) + 1000);
    const generatedOrderCode = `${day}${month}${dayOfWeek}${randomNum}`;
    const orderCodeToUse = generatedOrderCode;

    const updatedSalesInstance = await SalesInstance.updateOne(
      { _id: salesInstanceId },
      {
        $push: {
          salesGroup: {
            orderCode: orderCodeToUse,
            ordersIds: ordersIdsCreated,
            createdAt: new Date(),
          },
        },
      },
      { session },
    );

    if (updatedSalesInstance.modifiedCount === 0) {
      return "SalesInstance not updated!";
    }

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

export default createOrders;
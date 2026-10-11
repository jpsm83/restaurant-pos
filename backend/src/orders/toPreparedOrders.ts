/**
 * Maps an `ordersArr` DTO (client-settable fields, ObjectIds as strings) to the
 * `Partial<IOrder>` shape the order helpers (`ordersArrValidation`,
 * `applyPromotionsToOrders`, `createOrders`) consume. Shared by the orders and
 * salesInstances routes so the DTO-to-domain bridge lives in one place.
 */
import { Types } from "mongoose";
import type { IOrder } from "../../../packages/interfaces/IOrder.ts";
import type { OrderItem } from "../../../packages/schemas/orders.ts";

const toPreparedOrders = (ordersArr: OrderItem[]): Partial<IOrder>[] =>
  ordersArr.map((order) => ({
    orderGrossPrice: order.orderGrossPrice,
    orderNetPrice: order.orderNetPrice,
    orderCostPrice: order.orderCostPrice,
    businessGoodId: new Types.ObjectId(order.businessGoodId),
    addOns: order.addOns?.map((addOnId) => new Types.ObjectId(addOnId)),
    allergens: order.allergens,
    promotionApplyed: order.promotionApplyed,
    comments: order.comments,
  }));

export default toPreparedOrders;

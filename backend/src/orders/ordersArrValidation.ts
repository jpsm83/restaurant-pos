import type { IOrder } from "../../../lib/interface/IOrder.ts";
import { Types } from "mongoose";
import isObjectIdValid from "../utils/isObjectIdValid.ts";

const ordersArrValidation = (ordersArr: Partial<IOrder>[]): true | string => {
  if (
    !Array.isArray(ordersArr) ||
    ordersArr.length === 0 ||
    ordersArr.some((order) => typeof order !== "object")
  ) {
    return "OrdersArr must be an array of objects!";
  }

  if (
    ordersArr.some(
      (order) =>
        !order.businessGoodId || !Types.ObjectId.isValid(order.businessGoodId)
    )
  ) {
    return "businessGoodId is required and must be a valid ObjectId!";
  }

  if (
    ordersArr.some(
      (order) =>
        order.addOns != null &&
        (!Array.isArray(order.addOns) ||
          order.addOns.some((id: Types.ObjectId) => !Types.ObjectId.isValid(id)))
    )
  ) {
    return "addOns must be an array of valid ObjectIds when present!";
  }

  const allIds = ordersArr.flatMap((order) => [
    order.businessGoodId!,
    ...(order.addOns ?? []),
  ]);
  if (isObjectIdValid(allIds) !== true) {
    return "Invalid businessGoodId or addOns!";
  }

  const validKeys = [
    "orderGrossPrice",
    "orderNetPrice",
    "orderCostPrice",
    "businessGoodId",
    "addOns",
    "allergens",
    "promotionApplyed",
    "comments",
  ];

  const requiredFields = [
    "orderGrossPrice",
    "orderNetPrice",
    "orderCostPrice",
    "businessGoodId",
  ];

  for (const order of ordersArr) {
    for (const key of Object.keys(order)) {
      if (!validKeys.includes(key)) {
        return `Invalid key: ${key}`;
      }
    }

    for (const field of requiredFields) {
      if (!order[field as keyof IOrder]) {
        return `${field} must have a value!`;
      }
    }
  }

  return true;
}

export default ordersArrValidation;
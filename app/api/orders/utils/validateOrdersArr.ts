import { IOrder } from "@/app/lib/interface/IOrder";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { Types } from "mongoose";

// helper function to validate orders array
export const ordersArrValidation = (ordersArr: Partial<IOrder>[]) => {
  // check address is an object
  if (
    !Array.isArray(ordersArr) ||
    ordersArr.length === 0 ||
    ordersArr.some((order) => typeof order !== "object")
  )
    return "OrdersArr must be an array of objects!";

  if (
    ordersArr.some(
      (order) =>
        !Array.isArray(order.businessGoodsIds) ||
        order.businessGoodsIds.length === 0 ||
        order.businessGoodsIds.some(
          (id: Types.ObjectId) => !Types.ObjectId.isValid(id)
        )
    )
  )
    return "BusinessGoodsIds must be an array of Ids!";

// Validate ids
const businessGoodsIds: any = ordersArr.flatMap((order) => order.businessGoodsIds);

if(isObjectIdValid(businessGoodsIds) !== true) {
  return "Invalid businessGoodsIds!";
};

  const validKeys = [
    "orderGrossPrice",
    "orderNetPrice",
    "orderCostPrice",
    "businessGoodsIds",
    "allergens",
    "promotionApplyed",
    "comments",
  ];

  const requiredFields = [
    "orderGrossPrice",
    "orderNetPrice",
    "orderCostPrice",
    "businessGoodsIds",
  ];

  // Check for invalid keys and required fields
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
};

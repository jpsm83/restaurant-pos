import { Types } from "mongoose";
import { IPaymentMethod } from "./IPaymentMethod";

export interface IOrder {
  _id: Types.ObjectId;
  dailyReferenceNumber: number;
  billingStatus?: string;
  orderStatus?: string;
  orderGrossPrice: number;
  orderNetPrice: number;
  orderCostPrice: number;
  createdByUserId?: Types.ObjectId;
  createdAsRole?: "employee" | "customer";
  salesInstanceId: Types.ObjectId;
  businessGoodId: Types.ObjectId;
  addOns?: Types.ObjectId[];
  businessId: Types.ObjectId;
  orderTips?: number;
  paymentMethod?: IPaymentMethod[];
  allergens?: string[];
  promotionApplyed?: string;
  discountPercentage?: number;
  comments?: string;
}

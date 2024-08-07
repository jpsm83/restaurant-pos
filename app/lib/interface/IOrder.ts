import { Types } from "mongoose";

export interface IPaymentMethod {
  method: string;
  card?: string;
  crypto?: string;
  other?: string;
  paymentMethodAmount: number;
}

export interface IOrder {
    _id?: Types.ObjectId;
    dayReferenceNumber: number;
    orderPrice: number;
    orderNetPrice: number;
    orderCostPrice: number;
    user: Types.ObjectId;
    userRole?: string;
    table: Types.ObjectId;
    businessGoods: Types.ObjectId[];
    businessGoodsCategory?: string;
    business: Types.ObjectId;
    orderStatus?: string;
    allergens?: string[];
    promotionApplyed?: string;
    discountPercentage?: number;
    comments?: string;
    billingStatus?: string;
    paymentMethod?: IPaymentMethod[];
}

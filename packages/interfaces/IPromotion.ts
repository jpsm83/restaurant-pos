import { Types } from "mongoose";
import type { ClientSession } from "mongoose";
import { IOrder } from "./IOrder.ts";

export interface IPromotionPeriod {
  start: Date;
  end: Date;
}

export type WeekDays = string[];
export type ObjectId = Types.ObjectId;

export type PromotionType = {
  fixedPrice?: number;
  discountPercent?: number;
  twoForOne?: boolean;
  threeForTwo?: boolean;
  secondHalfPrice?: boolean;
  fullComplimentary?: boolean;
  [key: string]: number | boolean | undefined;
};

export interface IPromotionPricingInput {
  businessId: ObjectId;
  ordersArr: Array<
    Pick<
      Partial<IOrder>,
      | "orderGrossPrice"
      | "orderNetPrice"
      | "orderCostPrice"
      | "businessGoodId"
      | "addOns"
      | "promotionApplyed"
      | "discountPercentage"
    >
  >;
  atDateTime?: Date;
  session?: ClientSession;
  /**
   * Promotion applicability context.
   * - "delivery": include only promotions where applyToDelivery === true
   * - "seated": apply promotions where applyToDelivery !== true (false or undefined)
   */
  flow?: "delivery" | "seated";
}

export interface IPricedOrderOutput {
  orderGrossPrice: number;
  orderNetPrice: number;
  orderCostPrice?: number;
  businessGoodId: ObjectId;
  addOns?: ObjectId[];
  promotionApplyed?: string;
  discountPercentage?: number;
}

/**
 * Lean projection of the `Promotion` document used by `applyPromotionsToOrders`.
 */
export type IPromotionDocLean = {
  promotionName: string;
  promotionPeriod: IPromotionPeriod;
  weekDays: WeekDays;
  activePromotion: boolean;
  promotionType: PromotionType;
  businessGoodsToApplyIds?: ObjectId[];
  applyToDelivery?: boolean;
};

export interface IPromotion {
  promotionName: string;
  promotionPeriod: IPromotionPeriod;
  weekDays: string[];
  activePromotion: boolean;
  promotionType: object;
  businessId: Types.ObjectId;
  businessGoodsToApplyIds?: Types.ObjectId[];
  applyToDelivery?: boolean;
  description?: string;
}

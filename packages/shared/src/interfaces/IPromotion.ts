import { Types } from "mongoose";

export interface IPromotionPeriod {
  start: Date;
  end: Date;
}

export interface IPromotion {
  promotionName: string;
  promotionPeriod: IPromotionPeriod;
  weekDays: string[];
  activePromotion: boolean;
  promotionType: object;
  businessId: Types.ObjectId;
  businessGoodsToApplyIds?: Types.ObjectId[];
  description?: string;
}

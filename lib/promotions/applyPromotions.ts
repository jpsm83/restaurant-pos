import { Types } from "mongoose";

import connectDb from "@/lib/db/connectDb";
import Promotion from "@/lib/db/models/promotion";
import { IOrder } from "@/lib/interface/IOrder";

type ObjectId = Types.ObjectId;

export interface IPromotionPricingInput {
  businessId: ObjectId;
  ordersArr: Array<
    Pick<
      Partial<IOrder>,
      "orderGrossPrice" | "businessGoodId" | "addOns" | "promotionApplyed" | "discountPercentage"
    >
  >;
  /**
   * Moment in time used to decide which promotions are active.
   * For new orders, pass `new Date()`; for existing orders, pass their createdAt.
   */
  atDateTime?: Date;
}

export interface IPricedOrderOutput {
  orderGrossPrice: number;
  orderNetPrice: number;
  businessGoodId: ObjectId;
  addOns?: ObjectId[];
  promotionApplyed?: string;
  discountPercentage?: number;
}

type PromotionDoc = {
  promotionName: string;
  promotionPeriod: { start: Date; end: Date };
  weekDays: string[];
  activePromotion: boolean;
  promotionType: {
    fixedPrice?: number;
    discountPercent?: number;
    twoForOne?: boolean;
    threeForTwo?: boolean;
    secondHalfPrice?: boolean;
    fullComplimentary?: boolean;
  };
  businessGoodsToApplyIds?: ObjectId[];
};

const weekDaysByIndex = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MANAGEMENT_ROLES = new Set<string>([
  "Owner",
  "General Manager",
  "Manager",
  "Assistant Manager",
  "MoD",
  "Admin",
  "Supervisor",
]);

const isWithinPromotionWindow = (promo: PromotionDoc, at: Date): boolean => {
  const { start, end } = promo.promotionPeriod;
  if (at < start || at > end) return false;

  const weekDayName = weekDaysByIndex[at.getDay()];
  if (!promo.weekDays.includes(weekDayName)) return false;

  return promo.activePromotion === true;
};

const promotionTargetsOrder = (
  promo: PromotionDoc,
  businessGoodsIds: ObjectId[]
): boolean => {
  if (!promo.businessGoodsToApplyIds || promo.businessGoodsToApplyIds.length === 0) {
    // Global promotion for the business
    return true;
  }

  const idsSet = new Set(
    promo.businessGoodsToApplyIds.map((id) => id.toString())
  );

  return businessGoodsIds.some((id) => idsSet.has(id.toString()));
};

const getEffectiveDiscountPercent = (promotionType: PromotionDoc["promotionType"]):
  | { mode: "fixedPrice"; fixedPrice: number }
  | { mode: "percent"; percent: number }
  | { mode: "fullComplimentary" }
  | null => {
  if (typeof promotionType.fixedPrice === "number") {
    return { mode: "fixedPrice", fixedPrice: promotionType.fixedPrice };
  }

  if (typeof promotionType.discountPercent === "number") {
    return { mode: "percent", percent: promotionType.discountPercent };
  }

  if (promotionType.fullComplimentary) {
    return { mode: "fullComplimentary" };
  }

  // Map multi-unit deals to equivalent per-order percentage discounts.
  // This keeps pricing consistent without needing to inspect other orders.
  if (promotionType.twoForOne) {
    // Pay for 1, get 2 → 50% off on average
    return { mode: "percent", percent: 50 };
  }

  if (promotionType.threeForTwo) {
    // Pay for 2, get 3 → 33.33% off on average
    return { mode: "percent", percent: 33.33 };
  }

  if (promotionType.secondHalfPrice) {
    // Pay 1.5 for 2 → 25% off on average
    return { mode: "percent", percent: 25 };
  }

  return null;
};

const applySinglePromotionToOrder = (
  orderGrossPrice: number,
  promotion: PromotionDoc
): { netPrice: number; promotionName?: string; discountPercentage?: number } => {
  const effective = getEffectiveDiscountPercent(promotion.promotionType);

  if (!effective) {
    return { netPrice: orderGrossPrice };
  }

  if (effective.mode === "fullComplimentary") {
    return {
      netPrice: 0,
      promotionName: promotion.promotionName,
      discountPercentage: 100,
    };
  }

  if (effective.mode === "fixedPrice") {
    // Fixed price overrides the gross price.
    return {
      netPrice: effective.fixedPrice,
      promotionName: promotion.promotionName,
      discountPercentage:
        orderGrossPrice > 0
          ? ((orderGrossPrice - effective.fixedPrice) / orderGrossPrice) * 100
          : undefined,
    };
  }

  // Percentage-based (including mapped multi-unit deals)
  const discountValue = (orderGrossPrice * effective.percent) / 100;
  const netPrice = Math.max(orderGrossPrice - discountValue, 0);

  return {
    netPrice,
    promotionName: promotion.promotionName,
    discountPercentage: effective.percent,
  };
};

/**
 * Calculate promotion-adjusted prices for a batch of orders.
 * Used to compute expected prices for validation; the API should persist only when
 * the client payload matches this result (no overwriting).
 */
export const applyPromotionsToOrders = async (
  params: IPromotionPricingInput
): Promise<IPricedOrderOutput[] | string> => {
  const { businessId, ordersArr } = params;
  const atDateTime = params.atDateTime ?? new Date();

  if (!ordersArr || ordersArr.length === 0) {
    return "ordersArr must contain at least one order to apply promotions!";
  }

  // connect before first call to DB
  await connectDb();

  try {
    const activePromotions = (await Promotion.find({
      businessId,
      activePromotion: true,
    })
      .select(
        "promotionName promotionPeriod weekDays activePromotion promotionType businessGoodsToApplyIds"
      )
      .lean()) as unknown as PromotionDoc[];

    const applicablePromotions = activePromotions.filter((promo) =>
      isWithinPromotionWindow(promo, atDateTime)
    );

    return ordersArr.map((order) => {
      const gross = order.orderGrossPrice ?? 0;
      const businessGoodId = order.businessGoodId;
      const addOns = order.addOns ?? [];

      if (!gross || !businessGoodId) {
        return {
          orderGrossPrice: gross,
          orderNetPrice: gross,
          businessGoodId: businessGoodId as ObjectId,
          addOns: addOns.length ? addOns : undefined,
        };
      }

      // Promotions apply only to the main product (businessGoodId), not to addOns
      const promosForOrder = applicablePromotions.filter((promo) =>
        promotionTargetsOrder(promo, [businessGoodId])
      );

      if (!promosForOrder.length) {
        return {
          orderGrossPrice: gross,
          orderNetPrice: gross,
          businessGoodId,
          addOns: addOns.length ? addOns : undefined,
          promotionApplyed: undefined,
          discountPercentage: undefined,
        };
      }

      // Choose the promotion that gives the lowest net price for the customer.
      let bestResult = {
        netPrice: gross,
        promotionName: undefined as string | undefined,
        discountPercentage: undefined as number | undefined,
      };

      for (const promo of promosForOrder) {
        const result = applySinglePromotionToOrder(gross, promo);

        if (result.netPrice < bestResult.netPrice) {
          bestResult = {
            netPrice: result.netPrice,
            promotionName: result.promotionName,
            discountPercentage: result.discountPercentage,
          };
        }
      }

      return {
        orderGrossPrice: gross,
        orderNetPrice: bestResult.netPrice,
        businessGoodId,
        addOns: addOns.length ? addOns : undefined,
        promotionApplyed: bestResult.promotionName,
        discountPercentage: bestResult.discountPercentage,
      };
    });
  } catch (error) {
    return "Apply promotions failed! Error: " + error;
  }
};

export { MANAGEMENT_ROLES };


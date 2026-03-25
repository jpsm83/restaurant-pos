import Promotion from "../models/promotion.ts";
import type {
  IPromotionDocLean,
  IPricedOrderOutput,
  IPromotionPricingInput,
  ObjectId,
  PromotionType,
} from "../../../packages/interfaces/IPromotion.ts";

export type {
  IPromotionPricingInput,
  IPricedOrderOutput,
} from "../../../packages/interfaces/IPromotion.ts";

const weekDaysByIndex = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const isWithinPromotionWindow = (
  promo: IPromotionDocLean,
  at: Date,
): boolean => {
  const { start, end } = promo.promotionPeriod;
  if (at < start || at > end) return false;

  const weekDayName = weekDaysByIndex[at.getDay()];
  if (!promo.weekDays.includes(weekDayName)) return false;

  return promo.activePromotion === true;
};

const promotionTargetsOrder = (
  promo: IPromotionDocLean,
  businessGoodsIds: ObjectId[],
): boolean => {
  if (
    !promo.businessGoodsToApplyIds ||
    promo.businessGoodsToApplyIds.length === 0
  ) {
    return true;
  }

  const idsSet = new Set(
    promo.businessGoodsToApplyIds.map((id) => id.toString()),
  );

  return businessGoodsIds.some((id) => idsSet.has(id.toString()));
};

const getEffectiveDiscountPercent = (
  promotionType: PromotionType,
):
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

  if (promotionType.twoForOne) {
    return { mode: "percent", percent: 50 };
  }

  if (promotionType.threeForTwo) {
    return { mode: "percent", percent: 33.33 };
  }

  if (promotionType.secondHalfPrice) {
    return { mode: "percent", percent: 25 };
  }

  return null;
};

const applySinglePromotionToOrder = (
  orderGrossPrice: number,
  promotion: IPromotionDocLean,
): {
  netPrice: number;
  promotionName?: string;
  discountPercentage?: number;
} => {
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
    return {
      netPrice: effective.fixedPrice,
      promotionName: promotion.promotionName,
      discountPercentage:
        orderGrossPrice > 0
          ? ((orderGrossPrice - effective.fixedPrice) / orderGrossPrice) * 100
          : undefined,
    };
  }

  const discountValue = (orderGrossPrice * effective.percent) / 100;
  const netPrice = Math.max(orderGrossPrice - discountValue, 0);

  return {
    netPrice,
    promotionName: promotion.promotionName,
    discountPercentage: effective.percent,
  };
};

const applyPromotionsToOrders = async (
  params: IPromotionPricingInput,
): Promise<IPricedOrderOutput[] | string> => {
  const { businessId, ordersArr, session, flow } = params;
  const atDateTime = params.atDateTime ?? new Date();

  if (!ordersArr || ordersArr.length === 0) {
    return "ordersArr must contain at least one order to apply promotions!";
  }

  try {
    const activePromotions = (await Promotion.find({
      businessId,
      activePromotion: true,
    })
      .select(
        "promotionName promotionPeriod weekDays activePromotion promotionType businessGoodsToApplyIds applyToDelivery",
      )
      .session(session ?? null)
      .lean()) as unknown as IPromotionDocLean[];

    const applicablePromotions = activePromotions.filter((promo) =>
      isWithinPromotionWindow(promo, atDateTime),
    );

    const isDeliveryFlow = flow === "delivery";
    const scopedPromotions = applicablePromotions.filter((promo) => {
      const applyToDelivery = promo.applyToDelivery === true;
      return isDeliveryFlow ? applyToDelivery : !applyToDelivery;
    });

    return ordersArr.map((order) => {
      const gross = order.orderGrossPrice ?? 0;
      const businessGoodId = order.businessGoodId;
      const addOns = order.addOns ?? [];
      const orderCostPrice = order.orderCostPrice;

      if (!gross || !businessGoodId) {
        return {
          orderGrossPrice: gross,
          orderNetPrice: gross,
          orderCostPrice,
          businessGoodId: businessGoodId as ObjectId,
          addOns: addOns.length ? addOns : undefined,
        };
      }

      const promosForOrder = scopedPromotions.filter((promo) =>
        promotionTargetsOrder(promo, [businessGoodId]),
      );

      if (!promosForOrder.length) {
        return {
          orderGrossPrice: gross,
          orderNetPrice: gross,
          orderCostPrice,
          businessGoodId,
          addOns: addOns.length ? addOns : undefined,
          promotionApplyed: undefined,
          discountPercentage: undefined,
        };
      }

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
        orderCostPrice,
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

export default applyPromotionsToOrders;

/**
 * Post-parse price check shared by the orders and self-ordering routes: the
 * client-submitted net price must be within `PRICE_TOLERANCE` of the
 * server-calculated net price and the applied promotion must match.
 *
 * `discountPercentage` is server-derived (never client-settable), so it is
 * deliberately not compared — doing so would reject every promoted order.
 */
import type { IOrder } from "domain/interfaces/IOrder";

const PRICE_TOLERANCE = 0.01;

type PricedOrder = Pick<
  Partial<IOrder>,
  "orderNetPrice" | "promotionApplyed"
>;

const orderPriceMatches = (
  client: PricedOrder,
  backend: PricedOrder,
): boolean =>
  Math.abs((client.orderNetPrice ?? 0) - (backend.orderNetPrice ?? 0)) <=
    PRICE_TOLERANCE && client.promotionApplyed === backend.promotionApplyed;

export default orderPriceMatches;

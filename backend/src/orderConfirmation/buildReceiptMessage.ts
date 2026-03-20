/**
 * Builds a short receipt message for order confirmation (email and in-app notification).
 * Used after self-order or delivery payment.
 */
export function buildReceiptMessage(params: {
  dailyReferenceNumber: string | number;
  totalNetPaidAmount: number;
  orderCount: number;
  orderCode?: string;
  currency?: string;
}): string {
  const ref = params.orderCode ?? String(params.dailyReferenceNumber);
  const currency = params.currency ? ` ${params.currency}` : "";
  return [
    `Order confirmed. Ref: ${ref}.`,
    `Total paid: ${params.totalNetPaidAmount.toFixed(2)}${currency}.`,
    `Show this to staff when collecting your order.`,
  ].join(" ");
}

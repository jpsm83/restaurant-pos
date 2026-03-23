export interface OrderReceiptTemplateInput {
  dailyReferenceNumber: string | number;
  totalNetPaidAmount: number;
  orderCount: number;
  orderCode?: string;
  currency?: string;
}

const buildOrderReceiptTemplate = (params: OrderReceiptTemplateInput): string => {
  const ref = params.orderCode ?? String(params.dailyReferenceNumber);
  const currency = params.currency ? ` ${params.currency}` : "";

  return [
    `Order confirmed. Ref: ${ref}.`,
    `Total paid: ${params.totalNetPaidAmount.toFixed(2)}${currency}.`,
    "Show this to staff when collecting your order.",
  ].join(" ");
};

export default buildOrderReceiptTemplate;


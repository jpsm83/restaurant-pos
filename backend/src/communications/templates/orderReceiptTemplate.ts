export interface OrderReceiptTemplateInput {
  dailyReferenceNumber: string | number;
  totalNetPaidAmount: number;
  orderCount: number;
  orderCode?: string;
  currency?: string;
  flow?: "delivery" | "selfOrder";
  clientName?: string;
  deliveryAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

const buildOrderReceiptTemplate = (params: OrderReceiptTemplateInput): string => {
  const ref = params.orderCode ?? String(params.dailyReferenceNumber);
  const currency = params.currency ? ` ${params.currency}` : "";
  const flowLabel =
    params.flow === "delivery"
      ? "Delivery"
      : params.flow === "selfOrder"
        ? "Self-order"
        : "Order";

  const address = params.deliveryAddress
    ? [
        params.deliveryAddress.street,
        [
          params.deliveryAddress.city,
          params.deliveryAddress.state,
          params.deliveryAddress.postalCode,
        ]
          .filter(Boolean)
          .join(" "),
        params.deliveryAddress.country,
      ]
        .filter(Boolean)
        .join(", ")
    : null;

  const lines: string[] = [];
  lines.push(`${flowLabel} confirmed.`);
  lines.push(`Ref: ${ref}`);
  if (params.clientName) lines.push(`Customer: ${params.clientName}`);
  lines.push(`Items: ${params.orderCount}`);
  lines.push(`Total paid: ${params.totalNetPaidAmount.toFixed(2)}${currency}`);
  if (address) lines.push(`Delivery address: ${address}`);
  lines.push("Keep this receipt for your records.");
  return lines.join("\n");
};

export default buildOrderReceiptTemplate;


import { Types } from "mongoose";
import dispatchEvent from "../communications/dispatchEvent.ts";

export interface OrderConfirmationParams {
  dailyReferenceNumber: string | number;
  totalNetPaidAmount: number;
  orderCount: number;
  orderCode?: string;
  flow?: "delivery" | "selfOrder";
  clientName?: string;
  deliveryAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  /**
   * Idempotency key passed down to communications dispatch to prevent
   * duplicate receipts/notifications on payment retries.
   */
  idempotencyKey?: string;
}

/**
 * Sends order confirmation after self-order (or delivery) payment: email + in-app notification.
 * Call fire-and-forget (e.g. .catch(() => {})) so failures do not affect the order response.
 */
const sendOrderConfirmation = async (
  userId: Types.ObjectId,
  businessId: Types.ObjectId,
  params: OrderConfirmationParams
): Promise<void> => {
  try {
    await dispatchEvent(
      "ORDER_CONFIRMED",
      {
        businessId,
        userId,
        dailyReferenceNumber: params.dailyReferenceNumber,
        totalNetPaidAmount: params.totalNetPaidAmount,
        orderCount: params.orderCount,
        orderCode: params.orderCode,
        flow: params.flow,
        clientName: params.clientName,
        deliveryAddress: params.deliveryAddress,
      },
      { fireAndForget: true, idempotencyKey: params.idempotencyKey }
    );
  } catch (error) {
    console.error("[orderConfirmation] sendOrderConfirmation failed:", error);
  }
};

export default sendOrderConfirmation;

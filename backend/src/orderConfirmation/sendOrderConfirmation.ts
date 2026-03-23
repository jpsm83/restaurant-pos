import { Types } from "mongoose";
import dispatchEvent from "../communications/dispatchEvent.ts";

export interface OrderConfirmationParams {
  dailyReferenceNumber: string | number;
  totalNetPaidAmount: number;
  orderCount: number;
  orderCode?: string;
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
      },
      { fireAndForget: true }
    );
  } catch (error) {
    console.error("[orderConfirmation] sendOrderConfirmation failed:", error);
  }
};

export default sendOrderConfirmation;

import { Types } from "mongoose";
import User from "../models/user.ts";
import buildReceiptMessage from "./buildReceiptMessage.ts";
import sendOrderConfirmationNotification from "./sendOrderConfirmationNotification.ts";
import sendReceiptEmail from "./sendReceiptEmail.ts";

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
    const user = (await User.findById(userId)
      .select("personalDetails.email")
      .lean()) as
      | { personalDetails?: { email?: string } }
      | null;

    const receiptMessage = buildReceiptMessage({
      dailyReferenceNumber: params.dailyReferenceNumber,
      totalNetPaidAmount: params.totalNetPaidAmount,
      orderCount: params.orderCount,
      orderCode: params.orderCode,
    });

    const ref = params.orderCode ?? String(params.dailyReferenceNumber);

    const email = user?.personalDetails?.email;
    if (email) {
      await sendReceiptEmail(email, receiptMessage, { ref });
    }

    await sendOrderConfirmationNotification(userId, businessId, receiptMessage);
  } catch (error) {
    console.error("[orderConfirmation] sendOrderConfirmation failed:", error);
  }
};

export default sendOrderConfirmation;

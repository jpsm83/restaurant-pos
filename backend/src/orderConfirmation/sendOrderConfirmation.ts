import { Types } from "mongoose";
import User from "../models/user.js";
import { buildReceiptMessage } from "./buildReceiptMessage.js";
import { sendOrderConfirmationNotification } from "./sendOrderConfirmationNotification.js";
import { sendReceiptEmail } from "./sendReceiptEmail.js";

export interface OrderConfirmationParams {
  dailyReferenceNumber: string | number;
  totalNetPaidAmount: number;
  orderCount: number;
  orderCode?: string;
}

export async function sendOrderConfirmation(
  userId: Types.ObjectId,
  businessId: Types.ObjectId,
  params: OrderConfirmationParams
): Promise<void> {
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
}

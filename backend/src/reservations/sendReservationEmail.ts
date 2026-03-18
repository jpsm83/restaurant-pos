/**
 * sendReservationEmail - Sends a reservation-related email
 *
 * Uses the same SMTP setup as receipts. Fire-and-forget safe.
 */

import { sendReceiptEmail } from "../orderConfirmation/sendReceiptEmail.js";

export async function sendReservationEmail(
  toEmail: string,
  message: string,
  options?: { ref?: string; subject?: string }
): Promise<void> {
  await sendReceiptEmail(toEmail, message, {
    ref: options?.ref,
    subject: options?.subject,
  });
}

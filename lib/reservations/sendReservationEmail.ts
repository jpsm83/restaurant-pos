import { sendReceiptEmail } from "@/lib/orderConfirmation/sendReceiptEmail";

/**
 * Sends a reservation-related email. Uses the same SMTP setup as receipts.
 * Fire-and-forget safe: does not throw.
 */
export async function sendReservationEmail(
  toEmail: string,
  message: string,
  options?: { ref?: string; subject?: string }
): Promise<void> {
  // Reuse receipt email sender to avoid duplicating SMTP wiring.
  await sendReceiptEmail(toEmail, message, {
    ref: options?.ref,
    subject: options?.subject,
  });
}


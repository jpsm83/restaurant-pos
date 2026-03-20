/**
 * sendReservationEmail - Sends a reservation-related email
 *
 * Uses the same SMTP setup as receipts. Fire-and-forget safe.
 */

import sendReceiptEmail from "../orderConfirmation/sendReceiptEmail.ts";

/**
 * Sends a reservation-related email. Uses the same SMTP setup as receipts.
 * Fire-and-forget safe: does not throw.
 */
const sendReservationEmail = async (
  toEmail: string,
  message: string,
  options?: { ref?: string; subject?: string },
): Promise<void> => {
  await sendReceiptEmail(toEmail, message, {
    ref: options?.ref,
    subject: options?.subject,
  });
};

export default sendReservationEmail;

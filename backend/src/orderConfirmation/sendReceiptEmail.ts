import nodemailer from "nodemailer";

/**
 * Sends an order confirmation/receipt email. Fire-and-forget safe: does not throw.
 * If SMTP env is missing or send fails, logs and returns; caller is not affected.
 */
const sendReceiptEmail = async (
  toEmail: string,
  receiptMessage: string,
  options?: { subject?: string; ref?: string }
): Promise<void> => {
  if (!toEmail?.trim()) return;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !port || !user || !pass) {
    console.warn(
      "[orderConfirmation] SMTP not configured (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS). Skipping email."
    );
    return;
  }

  try {
    const transport = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: port === "465",
      auth: { user, pass },
    });

    const ref = options?.ref ?? "order";
    const subject =
      options?.subject ?? `Order confirmation – Ref ${ref}`;

    await transport.sendMail({
      from: from || user,
      to: toEmail,
      subject,
      text: receiptMessage,
    });
  } catch (error) {
    console.error("[orderConfirmation] sendReceiptEmail failed:", error);
  }
}

export default sendReceiptEmail;
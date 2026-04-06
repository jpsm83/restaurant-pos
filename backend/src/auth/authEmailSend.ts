import nodemailer from "nodemailer";
import type { AuthEmailTemplateContent } from "./emailTemplates.ts";

/**
 * Health-style auth email sender: simple Gmail transporter using EMAIL_USER/EMAIL_PASSWORD.
 */
export async function sendAuthTransactionalEmail(options: {
  to: string;
  content: AuthEmailTemplateContent;
  correlationId?: string;
}): Promise<void> {
  const to = options.to.trim();
  if (!to) {
    throw new Error("Recipient email is required");
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    throw new Error(
      "Email configuration is missing. Please set EMAIL_USER and EMAIL_PASSWORD environment variables.",
    );
  }

  const { subject, text, html } = options.content;
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"Restaurant POS" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
}

/**
 * Sends the email; on any failure runs `rollback` once (e.g. clear issued token fields) then rethrows.
 */
export async function sendAuthTransactionalEmailWithRollback(options: {
  to: string;
  content: AuthEmailTemplateContent;
  correlationId?: string;
  rollback: () => Promise<void>;
}): Promise<void> {
  try {
    await sendAuthTransactionalEmail({
      to: options.to,
      content: options.content,
    });
  } catch (error) {
    await options.rollback();
    throw error;
  }
}

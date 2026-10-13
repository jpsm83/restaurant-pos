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
    from: `"POS" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
}

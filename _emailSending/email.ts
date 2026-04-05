import * as nodemailer from "nodemailer";

export function createEmailTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
}

export function validateEmailConfig() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    throw new Error(
      "Email configuration is missing. Please set EMAIL_USER and EMAIL_PASSWORD environment variables."
    );
  }
}

export interface SendEmailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(mailOptions: SendEmailOptions) {
  validateEmailConfig();
  const transporter = createEmailTransporter();
  
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Email sending failed:", error);
    throw error;
  }
}


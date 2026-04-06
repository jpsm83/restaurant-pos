import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { sendMailMock, createTransportMock } = vi.hoisted(() => {
  const sendMail = vi.fn();
  const createTransport = vi.fn(() => ({ sendMail }));
  return { sendMailMock: sendMail, createTransportMock: createTransport };
});

vi.mock("nodemailer", () => ({
  default: {
    createTransport: createTransportMock,
  },
}));

import {
  sendAuthTransactionalEmail,
  sendAuthTransactionalEmailWithRollback,
} from "../../src/auth/authEmailSend.ts";
import type { AuthEmailTemplateContent } from "../../src/auth/emailTemplates.ts";

const sampleContent: AuthEmailTemplateContent = {
  subject: "Test subject",
  text: "Plain body",
  html: "<p>Html body</p>",
};

describe("authEmailSend", () => {
  beforeEach(() => {
    sendMailMock.mockReset();
    createTransportMock.mockClear();
    createTransportMock.mockImplementation(() => ({ sendMail: sendMailMock }));
    vi.stubEnv("EMAIL_USER", "sender@test.com");
    vi.stubEnv("EMAIL_PASSWORD", "secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sendAuthTransactionalEmail trims recipient and calls sendMail with Gmail transport", async () => {
    sendMailMock.mockResolvedValue(undefined);

    await sendAuthTransactionalEmail({
      to: "  user@test.com  ",
      content: sampleContent,
      correlationId: "corr-1",
    });

    expect(createTransportMock).toHaveBeenCalledWith({
      service: "gmail",
      auth: { user: "sender@test.com", pass: "secret" },
    });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledWith({
      from: '"Restaurant POS" <sender@test.com>',
      to: "user@test.com",
      subject: sampleContent.subject,
      text: sampleContent.text,
      html: sampleContent.html,
    });
  });

  it("throws when recipient is empty", async () => {
    await expect(
      sendAuthTransactionalEmail({ to: "   ", content: sampleContent }),
    ).rejects.toThrow("Recipient email is required");
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("throws when EMAIL_USER or EMAIL_PASSWORD is missing", async () => {
    const prevUser = process.env.EMAIL_USER;
    const prevPass = process.env.EMAIL_PASSWORD;
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASSWORD;
    try {
      await expect(
        sendAuthTransactionalEmail({
          to: "a@test.com",
          content: sampleContent,
        }),
      ).rejects.toThrow(
        "Email configuration is missing. Please set EMAIL_USER and EMAIL_PASSWORD environment variables.",
      );
    } finally {
      if (prevUser !== undefined) process.env.EMAIL_USER = prevUser;
      if (prevPass !== undefined) process.env.EMAIL_PASSWORD = prevPass;
    }
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("sendAuthTransactionalEmailWithRollback runs rollback then rethrows on send failure", async () => {
    sendMailMock.mockRejectedValue(new Error("SMTP failed"));

    const rollback = vi.fn().mockResolvedValue(undefined);

    await expect(
      sendAuthTransactionalEmailWithRollback({
        to: "a@test.com",
        content: sampleContent,
        rollback,
      }),
    ).rejects.toThrow("SMTP failed");

    expect(rollback).toHaveBeenCalledTimes(1);
  });

  it("sendAuthTransactionalEmailWithRollback does not rollback on success", async () => {
    sendMailMock.mockResolvedValue(undefined);

    const rollback = vi.fn();

    await sendAuthTransactionalEmailWithRollback({
      to: "a@test.com",
      content: sampleContent,
      rollback,
    });

    expect(rollback).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();

vi.mock("../../src/communications/channels/emailChannel.ts", () => ({
  default: { send: (...args: unknown[]) => sendMock(...args) },
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
    sendMock.mockReset();
  });

  it("sendAuthTransactionalEmail calls emailChannel with fireAndForget true and trimmed to", async () => {
    sendMock.mockResolvedValue({
      channel: "email",
      success: true,
      sentCount: 1,
    });

    await sendAuthTransactionalEmail({
      to: "  user@test.com  ",
      content: sampleContent,
      correlationId: "corr-1",
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith({
      to: "user@test.com",
      subject: sampleContent.subject,
      text: sampleContent.text,
      html: sampleContent.html,
      correlationId: "corr-1",
      fireAndForget: true,
    });
  });

  it("throws when recipient is empty", async () => {
    await expect(
      sendAuthTransactionalEmail({ to: "   ", content: sampleContent }),
    ).rejects.toThrow("Recipient email is required");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("throws when channel reports failure", async () => {
    sendMock.mockResolvedValue({
      channel: "email",
      success: false,
      sentCount: 0,
      error: "SMTP unavailable (missing_config)",
    });

    await expect(
      sendAuthTransactionalEmail({
        to: "a@test.com",
        content: sampleContent,
      }),
    ).rejects.toThrow("SMTP unavailable (missing_config)");
  });

  it("sendAuthTransactionalEmailWithRollback runs rollback then rethrows", async () => {
    sendMock.mockResolvedValue({
      channel: "email",
      success: false,
      sentCount: 0,
      error: "send failed",
    });

    const rollback = vi.fn().mockResolvedValue(undefined);

    await expect(
      sendAuthTransactionalEmailWithRollback({
        to: "a@test.com",
        content: sampleContent,
        rollback,
      }),
    ).rejects.toThrow("send failed");

    expect(rollback).toHaveBeenCalledTimes(1);
  });

  it("sendAuthTransactionalEmailWithRollback does not rollback on success", async () => {
    sendMock.mockResolvedValue({
      channel: "email",
      success: true,
      sentCount: 1,
    });

    const rollback = vi.fn();

    await sendAuthTransactionalEmailWithRollback({
      to: "a@test.com",
      content: sampleContent,
      rollback,
    });

    expect(rollback).not.toHaveBeenCalled();
  });
});

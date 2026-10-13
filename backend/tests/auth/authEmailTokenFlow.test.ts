import { describe, it, expect, vi, beforeEach } from "vitest";

const sendEmailMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("../../src/auth/authEmailSend.ts", () => ({
  sendAuthTransactionalEmail: sendEmailMock,
}));

import { sendAuthTokenEmailOrRollback } from "../../src/auth/authEmailTokenFlow.ts";
import type { AuthEmailTemplateContent } from "../../src/auth/emailTemplates.ts";

const content: AuthEmailTemplateContent = {
  subject: "Subject",
  text: "Text",
  html: "<p>Html</p>",
};

describe("sendAuthTokenEmailOrRollback", () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue(undefined);
  });

  it("persists a CSPRNG token, emails the built link, and returns true", async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const rollback = vi.fn().mockResolvedValue(undefined);
    const buildLink = vi.fn((token: string) => `https://app.test/go?token=${token}`);

    const sent = await sendAuthTokenEmailOrRollback({
      to: "new@example.com",
      persist,
      buildLink,
      buildContent: () => content,
      rollback,
    });

    expect(sent).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
    const token = persist.mock.calls[0][0] as string;
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(buildLink).toHaveBeenCalledWith(token);
    expect(sendEmailMock).toHaveBeenCalledWith({
      to: "new@example.com",
      content,
    });
    expect(rollback).not.toHaveBeenCalled();
  });

  it("rolls back and returns false when the send fails", async () => {
    sendEmailMock.mockRejectedValue(new Error("SMTP down"));
    const rollback = vi.fn().mockResolvedValue(undefined);

    const sent = await sendAuthTokenEmailOrRollback({
      to: "new@example.com",
      persist: vi.fn().mockResolvedValue(undefined),
      buildLink: (token) => `https://app.test/go?token=${token}`,
      buildContent: () => content,
      rollback,
    });

    expect(sent).toBe(false);
    expect(rollback).toHaveBeenCalledTimes(1);
  });
});

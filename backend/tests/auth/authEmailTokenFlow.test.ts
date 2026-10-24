import { describe, it, expect, vi, beforeEach } from "vitest";

const sendEmailMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    channel: "email",
    success: true,
    sentCount: 1,
  }),
);

vi.mock("../../src/communications/channels/emailChannel.ts", () => ({
  default: { send: sendEmailMock },
}));

import { sendAuthTokenEmailOrRollback } from "../../src/auth/authEmailTokenFlow.ts";
import type { AuthEmailTemplateContent } from "../../src/auth/emailTemplates.ts";
import {
  emailRailFailure,
  emailRailSuccess,
} from "../helpers/accountEmailRail.ts";

const content: AuthEmailTemplateContent = {
  subject: "Subject",
  text: "Plain words",
  html: "<p>Rich words</p>",
};

describe("sendAuthTokenEmailOrRollback", () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue(emailRailSuccess);
  });

  it("persists a token and sends that one address the template plain and rich parts", async () => {
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
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith({
      to: "new@example.com",
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    expect(sendEmailMock.mock.calls[0][0]).not.toHaveProperty("replyTo");
    expect(rollback).not.toHaveBeenCalled();
  });

  it("clears the pending link and returns false when the rail reports failure", async () => {
    sendEmailMock.mockResolvedValue(emailRailFailure);
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

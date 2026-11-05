import { describe, it, expect, vi, beforeEach } from "vitest";

const sendEmailMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/communications/channels/emailChannel.ts", () => ({
  default: { send: sendEmailMock },
}));

import { sendSignInConfirmationEmail } from "../../src/auth/signInConfirmationEmail.ts";
import {
  emailRailFailure,
  emailRailSuccess,
} from "../helpers/accountEmailRail.ts";

describe("sendSignInConfirmationEmail", () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
  });

  it("sends one security notice without a link", async () => {
    sendEmailMock.mockResolvedValue(emailRailSuccess);

    const sent = await sendSignInConfirmationEmail({
      to: "pat@example.com",
      greetingName: "Pat",
    });

    expect(sent).toBe(true);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const payload = sendEmailMock.mock.calls[0]?.[0] as {
      to?: string;
      subject?: string;
      html?: string;
    };
    expect(payload.to).toBe("pat@example.com");
    expect(payload.subject).toBe("New Sign-In to Your POS Account");
    expect(payload.html).not.toContain("href=");
  });

  it("logs a failed send and returns false", async () => {
    sendEmailMock.mockResolvedValue(emailRailFailure);
    const logger = { error: vi.fn() };

    const sent = await sendSignInConfirmationEmail({
      to: "pat@example.com",
      logger,
    });

    expect(sent).toBe(false);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("logs a thrown send and returns false", async () => {
    sendEmailMock.mockRejectedValue(new Error("smtp down"));
    const logger = { error: vi.fn() };

    const sent = await sendSignInConfirmationEmail({
      to: "pat@example.com",
      logger,
    });

    expect(sent).toBe(false);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});

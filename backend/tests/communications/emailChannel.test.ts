import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSmtpProviderStateMock = vi.fn();

vi.mock("../../src/communications/providers/smtpProvider.ts", () => ({
  getSmtpProviderState: () => getSmtpProviderStateMock(),
}));

import emailChannel from "../../src/communications/channels/emailChannel.ts";

const originalEnv = { ...process.env };

describe("emailChannel dev sink behavior", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AUTH_EMAIL_DEV_SINK_ENABLED;
    getSmtpProviderStateMock.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns failure when SMTP is unavailable and dev sink is disabled", async () => {
    getSmtpProviderStateMock.mockReturnValue({
      enabled: false,
      reason: "missing_config",
    });

    const result = await emailChannel.send({
      to: "owner@demo.test",
      subject: "Reset password",
      text: "hello",
      fireAndForget: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("SMTP unavailable");
  });

  it("returns success when SMTP is unavailable and dev sink is enabled", async () => {
    process.env.AUTH_EMAIL_DEV_SINK_ENABLED = "true";
    process.env.NODE_ENV = "development";

    getSmtpProviderStateMock.mockReturnValue({
      enabled: false,
      reason: "missing_config",
    });

    const result = await emailChannel.send({
      to: "owner@demo.test",
      subject: "Reset password",
      text: "hello",
      fireAndForget: true,
    });

    expect(result.success).toBe(true);
    expect(result.sentCount).toBe(1);
  });
});

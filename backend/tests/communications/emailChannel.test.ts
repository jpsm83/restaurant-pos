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
    vi.useRealTimers();
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
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("SMTP unavailable");
  });

  it("sends one recipient once with both parts from the platform address and no reply-to", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "ok" });
    getSmtpProviderStateMock.mockReturnValue({
      enabled: true,
      fromAddress: "platform@example.com",
      transport: { sendMail },
    });

    const result = await emailChannel.send({
      to: "guest@example.com",
      subject: "Hello",
      text: "Plain words",
      html: "<p>Rich words</p>",
    });

    expect(result).toEqual({
      channel: "email",
      success: true,
      sentCount: 1,
    });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith({
      from: { name: "POS", address: "platform@example.com" },
      to: "guest@example.com",
      subject: "Hello",
      text: "Plain words",
      html: "<p>Rich words</p>",
    });
  });

  it("sends supplied text plus that text escaped into one paragraph when no rich part is given", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "ok" });
    getSmtpProviderStateMock.mockReturnValue({
      enabled: true,
      fromAddress: "platform@example.com",
      transport: { sendMail },
    });

    const result = await emailChannel.send({
      to: "guest@example.com",
      subject: "Order confirmation",
      text: "Total is 5 < 12 & drinks are ready",
    });

    expect(result.success).toBe(true);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith({
      from: { name: "POS", address: "platform@example.com" },
      to: "guest@example.com",
      subject: "Order confirmation",
      text: "Total is 5 < 12 & drinks are ready",
      html: "<p>Total is 5 &lt; 12 &amp; drinks are ready</p>",
    });
  });

  it("rejects a payload with more than one recipient without contacting the transport", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "ok" });
    getSmtpProviderStateMock.mockReturnValue({
      enabled: true,
      fromAddress: "platform@example.com",
      transport: { sendMail },
    });

    const result = await emailChannel.send({
      to: ["one@example.com", "two@example.com"] as unknown as string,
      subject: "Hello",
      text: "Plain words",
    });

    expect(result).toEqual({
      channel: "email",
      success: false,
      sentCount: 0,
      error: "Email must have exactly one recipient",
    });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("returns a failure for an empty recipient without contacting the transport", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "ok" });
    getSmtpProviderStateMock.mockReturnValue({
      enabled: true,
      fromAddress: "platform@example.com",
      transport: { sendMail },
    });

    const result = await emailChannel.send({
      to: "   ",
      subject: "Hello",
      text: "Plain words",
    });

    expect(result).toEqual({
      channel: "email",
      success: false,
      sentCount: 0,
      error: "No valid email recipient provided",
    });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("returns a failure for a missing subject without contacting the transport", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "ok" });
    getSmtpProviderStateMock.mockReturnValue({
      enabled: true,
      fromAddress: "platform@example.com",
      transport: { sendMail },
    });

    const result = await emailChannel.send({
      to: "guest@example.com",
      subject: "  ",
      text: "Plain words",
    });

    expect(result).toEqual({
      channel: "email",
      success: false,
      sentCount: 0,
      error: "Email subject is required",
    });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("returns a failure when the body has neither text nor a rich part", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "ok" });
    getSmtpProviderStateMock.mockReturnValue({
      enabled: true,
      fromAddress: "platform@example.com",
      transport: { sendMail },
    });

    const result = await emailChannel.send({
      to: "guest@example.com",
      subject: "Hello",
      text: "   ",
      html: "",
    });

    expect(result).toEqual({
      channel: "email",
      success: false,
      sentCount: 0,
      error: "Email content is required (text or html)",
    });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("rejects a comma-separated recipient list without contacting the transport", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "ok" });
    getSmtpProviderStateMock.mockReturnValue({
      enabled: true,
      fromAddress: "platform@example.com",
      transport: { sendMail },
    });

    const result = await emailChannel.send({
      to: "one@example.com, two@example.com",
      subject: "Hello",
      text: "Plain words",
    });

    expect(result).toEqual({
      channel: "email",
      success: false,
      sentCount: 0,
      error: "Email must have exactly one recipient",
    });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("retries a transient failure immediately when the retry wait is zero", async () => {
    process.env.COMMUNICATIONS_EMAIL_RETRY_BASE_DELAY_MS = "0";
    process.env.COMMUNICATIONS_EMAIL_RETRY_ATTEMPTS = "2";
    vi.useFakeTimers();
    const sendMail = vi.fn()
      .mockRejectedValueOnce(new Error("connection timeout"))
      .mockResolvedValueOnce({ messageId: "ok" });
    getSmtpProviderStateMock.mockReturnValue({
      enabled: true,
      fromAddress: "platform@example.com",
      transport: { sendMail },
    });

    const pending = emailChannel.send({
      to: "guest@example.com",
      subject: "Hello",
      text: "Plain words",
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(sendMail).toHaveBeenCalledTimes(2);
    await expect(pending).resolves.toEqual({
      channel: "email",
      success: true,
      sentCount: 1,
    });
  });

  it("returns a failure after a single attempt when the transport failure is permanent", async () => {
    process.env.COMMUNICATIONS_EMAIL_RETRY_BASE_DELAY_MS = "0";
    process.env.COMMUNICATIONS_EMAIL_RETRY_ATTEMPTS = "2";
    const sendMail = vi.fn().mockRejectedValue(new Error("550 mailbox unavailable"));
    getSmtpProviderStateMock.mockReturnValue({
      enabled: true,
      fromAddress: "platform@example.com",
      transport: { sendMail },
    });

    const result = await emailChannel.send({
      to: "guest@example.com",
      subject: "Hello",
      text: "Plain words",
    });

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      channel: "email",
      success: false,
      sentCount: 0,
      error: "550 mailbox unavailable",
    });
  });

  it("returns a failure when the default transient retry budget is exhausted", async () => {
    delete process.env.COMMUNICATIONS_EMAIL_RETRY_ATTEMPTS;
    process.env.COMMUNICATIONS_EMAIL_RETRY_BASE_DELAY_MS = "0";
    const sendMail = vi.fn().mockRejectedValue(new Error("connection timeout"));
    getSmtpProviderStateMock.mockReturnValue({
      enabled: true,
      fromAddress: "platform@example.com",
      transport: { sendMail },
    });

    const result = await emailChannel.send({
      to: "guest@example.com",
      subject: "Hello",
      text: "Plain words",
    });

    expect(sendMail).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      channel: "email",
      success: false,
      sentCount: 0,
      error: "connection timeout",
    });
  });

  it("uses the configured retry budget", async () => {
    process.env.COMMUNICATIONS_EMAIL_RETRY_ATTEMPTS = "1";
    process.env.COMMUNICATIONS_EMAIL_RETRY_BASE_DELAY_MS = "0";
    const sendMail = vi.fn().mockRejectedValue(new Error("connection reset"));
    getSmtpProviderStateMock.mockReturnValue({
      enabled: true,
      fromAddress: "platform@example.com",
      transport: { sendMail },
    });

    const result = await emailChannel.send({
      to: "guest@example.com",
      subject: "Hello",
      text: "Plain words",
    });

    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(false);
    expect(result.error).toBe("connection reset");
  });

  it("waits with exponential backoff from the configured base delay", async () => {
    process.env.COMMUNICATIONS_EMAIL_RETRY_BASE_DELAY_MS = "100";
    process.env.COMMUNICATIONS_EMAIL_RETRY_ATTEMPTS = "2";
    vi.useFakeTimers();
    const sendMail = vi.fn()
      .mockRejectedValueOnce(new Error("connection timeout"))
      .mockRejectedValueOnce(new Error("connection timeout"))
      .mockResolvedValueOnce({ messageId: "ok" });
    getSmtpProviderStateMock.mockReturnValue({
      enabled: true,
      fromAddress: "platform@example.com",
      transport: { sendMail },
    });

    const pending = emailChannel.send({
      to: "guest@example.com",
      subject: "Hello",
      text: "Plain words",
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(sendMail).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(99);
    expect(sendMail).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sendMail).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(199);
    expect(sendMail).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(sendMail).toHaveBeenCalledTimes(3);
    await expect(pending).resolves.toEqual({
      channel: "email",
      success: true,
      sentCount: 1,
    });
  });

  it("fails once when platform mail configuration is missing", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "ok" });
    getSmtpProviderStateMock.mockReturnValue({
      enabled: false,
      reason: "missing_config",
      transport: { sendMail },
    });

    const result = await emailChannel.send({
      to: "guest@example.com",
      subject: "Hello",
      text: "Plain words",
    });

    expect(sendMail).not.toHaveBeenCalled();
    expect(result).toEqual({
      channel: "email",
      success: false,
      sentCount: 0,
      error: "SMTP unavailable (missing_config)",
    });
  });

  it("fails once when platform mail configuration is invalid", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "ok" });
    getSmtpProviderStateMock.mockReturnValue({
      enabled: false,
      reason: "invalid_port",
      transport: { sendMail },
    });

    const result = await emailChannel.send({
      to: "guest@example.com",
      subject: "Hello",
      text: "Plain words",
    });

    expect(sendMail).not.toHaveBeenCalled();
    expect(result).toEqual({
      channel: "email",
      success: false,
      sentCount: 0,
      error: "SMTP unavailable (invalid_port)",
    });
  });

  it("accepts the message without SMTP when the non-production sink is enabled", async () => {
    process.env.AUTH_EMAIL_DEV_SINK_ENABLED = "true";
    process.env.NODE_ENV = "development";
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const sendMail = vi.fn().mockRejectedValue(new Error("550 mailbox unavailable"));
    getSmtpProviderStateMock.mockReturnValue({
      enabled: true,
      fromAddress: "platform@example.com",
      transport: { sendMail },
    });

    const result = await emailChannel.send({
      to: "guest@example.com",
      subject: "Preview subject",
      text: "Preview text",
    });

    expect(result).toEqual({
      channel: "email",
      success: true,
      sentCount: 1,
    });
    expect(sendMail).not.toHaveBeenCalled();
    expect(
      info.mock.calls.some(
        (call) =>
          String(call[0]).includes('subject="Preview subject"') &&
          String(call[0]).includes('text="Preview text"'),
      ),
    ).toBe(true);
    info.mockRestore();
  });

  it("still rejects an empty recipient when the non-production sink is enabled", async () => {
    process.env.AUTH_EMAIL_DEV_SINK_ENABLED = "true";
    process.env.NODE_ENV = "development";
    const sendMail = vi.fn().mockResolvedValue({ messageId: "ok" });
    getSmtpProviderStateMock.mockReturnValue({
      enabled: true,
      fromAddress: "platform@example.com",
      transport: { sendMail },
    });

    const result = await emailChannel.send({
      to: " ",
      subject: "Hello",
      text: "Plain words",
    });

    expect(result.success).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("keeps a transport failure in production when the sink flag is set", async () => {
    process.env.AUTH_EMAIL_DEV_SINK_ENABLED = "true";
    process.env.NODE_ENV = "production";
    process.env.COMMUNICATIONS_EMAIL_RETRY_ATTEMPTS = "2";
    process.env.COMMUNICATIONS_EMAIL_RETRY_BASE_DELAY_MS = "0";
    const sendMail = vi.fn().mockRejectedValue(new Error("550 mailbox unavailable"));
    getSmtpProviderStateMock.mockReturnValue({
      enabled: true,
      fromAddress: "platform@example.com",
      transport: { sendMail },
    });

    const result = await emailChannel.send({
      to: "guest@example.com",
      subject: "Hello",
      text: "Plain words",
    });

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      channel: "email",
      success: false,
      sentCount: 0,
      error: "550 mailbox unavailable",
    });
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
    });

    expect(result.success).toBe(true);
    expect(result.sentCount).toBe(1);
  });
});

import { expect } from "vitest";

/** Result the delivery rail returns when one recipient was accepted. */
export const emailRailSuccess = {
  channel: "email" as const,
  success: true,
  sentCount: 1,
};

/** Result the delivery rail returns when the send cannot be delivered. */
export const emailRailFailure = {
  channel: "email" as const,
  success: false,
  sentCount: 0,
  error: "SMTP down",
};

/**
 * The account caller handed the rail one address and the template's plain and
 * rich parts, and did not set a reply-to address.
 */
export function expectOneAccountSend(
  send: { mock: { calls: unknown[][] } },
  expected: { to: string; subject: string; link: string },
): void {
  expect(send.mock.calls).toHaveLength(1);
  const payload = send.mock.calls[0]?.[0] as {
    to?: unknown;
    subject?: unknown;
    text?: unknown;
    html?: unknown;
  };
  expect(payload.to).toBe(expected.to);
  expect(payload.subject).toBe(expected.subject);
  expect(payload.text).toEqual(expect.stringContaining(expected.link));
  expect(payload.html).toEqual(expect.stringContaining(expected.link));
  expect(String(payload.html)).toContain("<a ");
  expect(payload).not.toHaveProperty("replyTo");
}

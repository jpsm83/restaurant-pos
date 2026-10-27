import { describe, it, expect } from "vitest";

import {
  CIRCULAR_REFERENCE_MARKER,
  DEPTH_LIMIT_MARKER,
  REDACTION_MARKER,
  scrubTelemetry,
} from "restaurant-pos-packages/utils/sentryScrubbing";

describe("scrubTelemetry", () => {
  it("redacts sensitive values in nested objects and arrays", () => {
    const input = {
      user: {
        email: "guest@example.com",
        password: "hunter2",
        sessions: [
          { authorization: "Bearer abc", device: "phone" },
          { refreshToken: "refresh-123", device: "tablet" },
        ],
      },
    };

    expect(scrubTelemetry(input)).toEqual({
      user: {
        email: "guest@example.com",
        password: REDACTION_MARKER,
        sessions: [
          { authorization: REDACTION_MARKER, device: "phone" },
          { refreshToken: REDACTION_MARKER, device: "tablet" },
        ],
      },
    });
  });

  it("matches mixed-case and payment-like keys case-insensitively", () => {
    const input = {
      "X-Api-Key": "key-123",
      API_KEY: "key-456",
      APIKeys: ["key-789"],
      passwords: ["hunter2"],
      CardNumber: "4242424242424242",
      card_cvc: "123",
      cardExpiry: "12/34",
      IBAN: "GB00 0000 0000 0000",
      PaymentDetails: { brand: "visa", cvv2: "456" },
      card: { number: "4242424242424242", brand: "visa" },
    };

    expect(scrubTelemetry(input)).toEqual({
      "X-Api-Key": REDACTION_MARKER,
      API_KEY: REDACTION_MARKER,
      APIKeys: REDACTION_MARKER,
      passwords: REDACTION_MARKER,
      CardNumber: REDACTION_MARKER,
      card_cvc: REDACTION_MARKER,
      cardExpiry: REDACTION_MARKER,
      IBAN: REDACTION_MARKER,
      PaymentDetails: REDACTION_MARKER,
      card: REDACTION_MARKER,
    });
  });

  it("removes userinfo and query strings from telemetry URLs", () => {
    const input = {
      request: {
        url: "https://user:pass@example.com/orders/42?token=secret#receipt",
        relativeUrl: "/api/orders/42?token=secret#receipt",
        protocolRelative: "//user:pass@example.com/orders/42?token=secret",
        cleanUrl: "https://Example.COM/Orders/42",
        mailto: "mailto:guest@example.com?subject=receipt",
      },
      message: "Order 42 failed while loading",
    };

    expect(scrubTelemetry(input)).toEqual({
      request: {
        url: "https://example.com/orders/42#receipt",
        relativeUrl: "/api/orders/42#receipt",
        protocolRelative: "//example.com/orders/42",
        cleanUrl: "https://Example.COM/Orders/42",
        mailto: "mailto:guest@example.com",
      },
      message: "Order 42 failed while loading",
    });
  });

  it("preserves non-sensitive values, including keys that only contain a sensitive word", () => {
    const input = {
      tokenCount: 2,
      passwordStrength: "strong",
      authorizationStatus: "ok",
      paymentStatus: "paid",
      cookieCount: 4,
      secretary: "Ada",
      publicKey: "pk_123",
      message: "The token expired before payment",
    };

    expect(scrubTelemetry(input)).toEqual(input);
  });

  it("handles cycles and excessive depth without throwing or hanging", () => {
    const cycle: Record<string, unknown> = { name: "root" };
    cycle.self = cycle;

    const scrubbedCycle = scrubTelemetry(cycle);
    expect(scrubbedCycle.name).toBe("root");
    expect(scrubbedCycle.self).toBe(CIRCULAR_REFERENCE_MARKER);

    let deep: Record<string, unknown> = { leaf: true };
    for (let level = 0; level < 100; level += 1) {
      deep = { child: deep };
    }

    const scrubbedDeep = scrubTelemetry(deep);
    expect(JSON.stringify(scrubbedDeep)).toContain(DEPTH_LIMIT_MARKER);
  });

  it("never mutates its input", () => {
    const input = {
      user: { password: "hunter2", nested: [{ token: "abc" }] },
      url: "https://user:pass@example.com/orders?token=secret",
    };
    const snapshot = structuredClone(input);

    const result = scrubTelemetry(input);

    expect(input).toEqual(snapshot);
    expect(result).not.toBe(input);
    expect(result.user).not.toBe(input.user);
    expect(result.user.nested).not.toBe(input.user.nested);
    expect(result.user.nested[0]).not.toBe(input.user.nested[0]);
  });
});

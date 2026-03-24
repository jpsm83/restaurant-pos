import { describe, expect, it } from "vitest";
import {
  buildNotificationsLiveUrlWithToken,
  getReconnectDelayMs,
} from "./live";

describe("notifications live helpers", () => {
  it("builds live url including encoded access token", () => {
    const url = buildNotificationsLiveUrlWithToken("token.with spaces");
    expect(url).toContain("/api/v1/notifications/live");
    expect(url).toContain("access_token=");
  });

  it("uses exponential backoff with max cap", () => {
    expect(getReconnectDelayMs(0)).toBe(500);
    expect(getReconnectDelayMs(1)).toBe(1000);
    expect(getReconnectDelayMs(2)).toBe(2000);
    expect(getReconnectDelayMs(20)).toBe(10000);
  });
});


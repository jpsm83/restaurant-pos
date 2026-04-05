/**
 * Phase 7.2 — `fetch` contract for `/api/v1/auth/*` email flows (paths, bodies, errors).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmEmail,
  requestEmailConfirmation,
  requestPasswordReset,
  resetPassword,
  resendEmailConfirmation,
  setAccessToken,
} from "./api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("auth api — email / password-reset endpoints", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    setAccessToken(null);
    vi.unstubAllGlobals();
  });

  it("requestEmailConfirmation POSTs JSON email", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "OK" }));

    const result = await requestEmailConfirmation("user@example.com");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/auth\/request-email-confirmation$/);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.body).toBe(JSON.stringify({ email: "user@example.com" }));
    expect(result).toEqual({ ok: true, data: { message: "OK" } });
  });

  it("requestEmailConfirmation maps non-OK responses to error string", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: "Too many requests" }, 429),
    );

    const result = await requestEmailConfirmation("user@example.com");

    expect(result).toEqual({ ok: false, error: "Too many requests" });
  });

  it("requestEmailConfirmation uses generic copy when body has no message", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 500 }));

    const result = await requestEmailConfirmation("user@example.com");

    expect(result).toEqual({ ok: false, error: "Request failed" });
  });

  it("confirmEmail POSTs token", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Verified" }));

    const result = await confirmEmail("raw-token");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/auth\/confirm-email$/);
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ token: "raw-token" }));
    expect(result).toEqual({ ok: true, data: { message: "Verified" } });
  });

  it("requestPasswordReset POSTs email", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Check inbox" }));

    const result = await requestPasswordReset("a@b.co");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/auth\/request-password-reset$/);
    expect(init.body).toBe(JSON.stringify({ email: "a@b.co" }));
    expect(result.ok).toBe(true);
  });

  it("requestPasswordReset returns error when fetch rejects (network)", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const result = await requestPasswordReset("a@b.co");

    expect(result).toEqual({
      ok: false,
      error: "Failed to fetch",
    });
  });

  it("resetPassword POSTs token and newPassword", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Updated" }));

    const result = await resetPassword("tok", "NewPass1!");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(
      JSON.stringify({ token: "tok", newPassword: "NewPass1!" }),
    );
    expect(urlPath(fetchMock.mock.calls[0][0] as string)).toMatch(
      /\/api\/v1\/auth\/reset-password$/,
    );
    expect(result.ok).toBe(true);
  });

  it("resendEmailConfirmation sends Bearer when access token is set", async () => {
    setAccessToken("jwt-here");
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Sent" }));

    await resendEmailConfirmation();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers as HeadersInit);
    expect(headers.get("Authorization")).toBe("Bearer jwt-here");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({}));
    expect(urlPath(fetchMock.mock.calls[0][0] as string)).toMatch(
      /\/api\/v1\/auth\/resend-email-confirmation$/,
    );
  });
});

function urlPath(full: string): string {
  try {
    return new URL(full, "http://localhost").pathname;
  } catch {
    return full;
  }
}

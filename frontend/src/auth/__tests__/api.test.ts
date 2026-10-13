/**
 * Phase 7.2 — `fetch` contract for `/api/v1/auth/*` email flows (paths, bodies, errors).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmEmail,
  requestEmailChange,
  requestEmailConfirmation,
  requestPasswordReset,
  resetPassword,
  resendEmailConfirmation,
  setAccessToken,
} from "../api";

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

  it("requestEmailConfirmation reads the problem-details detail", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          type: "https://restaurant-pos.app/errors/conflict",
          title: "Conflict",
          status: 429,
          detail: "Too many requests",
          instance: "/api/v1/auth/request-email-confirmation",
        },
        429,
      ),
    );

    const result = await requestEmailConfirmation("user@example.com");

    expect(result).toEqual({ ok: false, error: "Too many requests" });
  });

  it("requestEmailConfirmation falls back to errors[] when detail is absent", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          title: "Bad Request",
          status: 400,
          errors: [{ path: "email", message: "Invalid email" }],
        },
        400,
      ),
    );

    const result = await requestEmailConfirmation("user@example.com");

    expect(result).toEqual({ ok: false, error: "Invalid email" });
  });

  it("requestEmailConfirmation uses generic copy when body has no problem details", async () => {
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

  it("requestEmailChange POSTs newEmail + currentPassword with Bearer auth", async () => {
    setAccessToken("jwt-here");
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Check inbox" }));

    const result = await requestEmailChange("new@example.com", "CurrentPass1!");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/auth\/request-email-change$/);
    expect(init.method).toBe("POST");
    expect(init.body).toBe(
      JSON.stringify({
        newEmail: "new@example.com",
        currentPassword: "CurrentPass1!",
      }),
    );
    const headers = new Headers(init.headers as HeadersInit);
    expect(headers.get("Authorization")).toBe("Bearer jwt-here");
    expect(result).toEqual({ ok: true, data: { message: "Check inbox" } });
  });

  it("requestEmailChange surfaces a wrong-password 401 after a failed refresh", async () => {
    setAccessToken("jwt-here");
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          {
            title: "Unauthorized",
            status: 401,
            detail: "Current password is incorrect.",
          },
          401,
        ),
      )
      // Refresh also fails (no valid refresh session): 401 is not retried.
      .mockResolvedValueOnce(jsonResponse({ message: "No" }, 401));

    const result = await requestEmailChange("new@example.com", "wrong");

    expect(result).toEqual({
      ok: false,
      error: "Current password is incorrect.",
    });
  });

  it("requestEmailChange refreshes an expired session and retries once", async () => {
    setAccessToken("stale-token");
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ message: "Unauthorized" }, 401))
      .mockResolvedValueOnce(
        jsonResponse({
          accessToken: "fresh-token",
          user: { id: "b1", email: "owner@demo.test", type: "business" },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ message: "Check inbox" }));

    const result = await requestEmailChange("new@example.com", "CurrentPass1!");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      urlPath(fetchMock.mock.calls[2][0] as string),
    ).toMatch(/\/api\/v1\/auth\/request-email-change$/);
    const headers = new Headers(
      (fetchMock.mock.calls[2][1] as RequestInit).headers as HeadersInit,
    );
    expect(headers.get("Authorization")).toBe("Bearer fresh-token");
    expect(result).toEqual({ ok: true, data: { message: "Check inbox" } });
  });

  it("requestEmailChange surfaces a duplicate-email conflict", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          title: "Conflict",
          status: 409,
          detail: "That email is already used by another account.",
        },
        409,
      ),
    );

    const result = await requestEmailChange("taken@example.com", "CurrentPass1!");

    expect(result).toEqual({
      ok: false,
      error: "That email is already used by another account.",
    });
  });

  it("requestEmailChange returns a network error when fetch rejects", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const result = await requestEmailChange("new@example.com", "CurrentPass1!");

    expect(result).toEqual({ ok: false, error: "Failed to fetch" });
  });
});

function urlPath(full: string): string {
  try {
    return new URL(full, "http://localhost").pathname;
  } catch {
    return full;
  }
}

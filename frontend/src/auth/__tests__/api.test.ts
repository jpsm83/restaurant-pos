/**
 * Phase 7.2 — `fetch` contract for `/api/v1/auth/*` email flows (paths, bodies, errors).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmEmail,
  confirmEmailChange,
  login,
  requestEmailChange,
  requestEmailConfirmation,
  requestPasswordReset,
  resetPassword,
  resendEmailConfirmation,
  setAccessToken,
} from "../api";
import { resetLiveConnectionForTests } from "@/live/connection";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function expectFailure(
  result: unknown,
  failure: {
    code: string;
    status?: number;
    serverMessage?: string;
    fieldErrors?: unknown;
  },
) {
  expect(result).toMatchObject({
    ok: false,
    error: expect.objectContaining(failure),
  });
}

describe("auth api — email / password-reset endpoints", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    // Keep the live-ticket exchange out of these HTTP-contract assertions.
    resetLiveConnectionForTests({
      requestTicket: () => null,
      scheduleReconnect: () => undefined,
    });
  });

  afterEach(() => {
    setAccessToken(null);
    vi.unstubAllGlobals();
  });

  it("login maps a legacy 401 message to a sign-in machine failure", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: "Invalid email or password" }, 401),
    );

    const result = await login({
      email: "user@example.com",
      password: "wrong",
    });

    expectFailure(result, {
      code: "signIn.unauthorized",
      status: 401,
      serverMessage: "Invalid email or password",
    });
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

    expectFailure(result, {
      code: "resendConfirmation.conflict",
      status: 429,
      serverMessage: "Too many requests",
    });
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

    expectFailure(result, {
      code: "resendConfirmation.validation",
      status: 400,
      serverMessage: "Invalid email",
      fieldErrors: [{ field: "email", message: "Invalid email" }],
    });
  });

  it("requestEmailConfirmation uses generic copy when body has no problem details", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 500 }));

    const result = await requestEmailConfirmation("user@example.com");

    expectFailure(result, {
      code: "resendConfirmation.internal",
      status: 500,
    });
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

    expectFailure(result, {
      code: "passwordReset.transport",
      serverMessage: "Failed to fetch",
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

    expectFailure(result, {
      code: "emailChange.unauthorized",
      status: 401,
      serverMessage: "Current password is incorrect.",
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

    expectFailure(result, {
      code: "emailChange.conflict",
      status: 409,
      serverMessage: "That email is already used by another account.",
    });
  });

  it("requestEmailChange returns a network error when fetch rejects", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const result = await requestEmailChange("new@example.com", "CurrentPass1!");

    expectFailure(result, {
      code: "emailChange.transport",
      serverMessage: "Failed to fetch",
    });
  });

  it("confirmEmailChange POSTs the token without an Authorization header", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Updated" }));

    const result = await confirmEmailChange("abc123");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/auth\/confirm-email-change$/);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.body).toBe(JSON.stringify({ token: "abc123" }));
    const headers = new Headers(init.headers as HeadersInit);
    expect(headers.get("Authorization")).toBeNull();
    expect(result).toEqual({ ok: true, data: { message: "Updated" } });
  });

  it("confirmEmailChange surfaces the non-revealing problem detail on failure", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          title: "Bad Request",
          status: 400,
          detail: "This link is invalid or has expired. Please request a new one.",
        },
        400,
      ),
    );

    const result = await confirmEmailChange("stale");

    expectFailure(result, {
      code: "confirmEmailChange.badRequest",
      status: 400,
      serverMessage:
        "This link is invalid or has expired. Please request a new one.",
    });
  });
});

function urlPath(full: string): string {
  try {
    return new URL(full, "http://localhost").pathname;
  } catch {
    return full;
  }
}

/**
 * Phase 7.2 — `fetch` contract for `/api/v1/auth/*` email flows (paths, bodies, errors).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmEmail,
  getAuthConfig,
  getCurrentUser,
  googleAuth,
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
    localStorage.clear();
    setAccessToken(null);
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

  it("does not try to refresh an anonymous 401", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: "Unauthorized" }, 401),
    );

    const result = await getCurrentUser();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectFailure(result, { code: "session.unauthorized", status: 401 });
  });

  it("refreshes once and retries when a prior session exists", async () => {
    localStorage.setItem("auth_had_session", "1");
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ message: "Unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ accessToken: "new-jwt" }))
      .mockResolvedValueOnce(
        jsonResponse({
          user: { id: "u1", email: "user@example.com", type: "user" },
        }),
      );

    const result = await getCurrentUser();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      ok: true,
      data: { id: "u1", email: "user@example.com", type: "user" },
    });
  });

  it("googleAuth POSTs the Google credential and language", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        accessToken: "google-access",
        user: { id: "u1", email: "google@example.com", type: "user" },
      }),
    );

    const result = await googleAuth({
      credential: "google-id-token",
      languagePreference: "es",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/auth\/google$/);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.body).toBe(
      JSON.stringify({
        credential: "google-id-token",
        languagePreference: "es",
      }),
    );
    expect(result).toEqual({
      ok: true,
      data: {
        accessToken: "google-access",
        user: { id: "u1", email: "google@example.com", type: "user" },
        reactivationRequired: false,
      },
    });
  });

  it("googleAuth marks a reactivation message as a machine outcome", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        message:
          "Account reactivation required. Please confirm the email link we sent to reactivate this account.",
      }),
    );

    const result = await googleAuth({ credential: "google-id-token" });

    expect(result).toEqual({
      ok: true,
      data: {
        accessToken: undefined,
        user: null,
        reactivationRequired: true,
      },
    });
  });

  it("googleAuth maps an invalid credential to the Google failure code", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          type: "https://restaurant-pos.app/errors/unauthorized",
          title: "Unauthorized",
          status: 401,
          detail: "Invalid Google credential",
          instance: "/api/v1/auth/google",
        },
        401,
      ),
    );

    const result = await googleAuth({ credential: "bad" });

    expectFailure(result, {
      code: "googleAuth.unauthorized",
      status: 401,
      serverMessage: "Invalid Google credential",
    });
  });

  it("getAuthConfig GETs the unauthenticated config endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ googleSignInEnabled: true }),
    );

    await expect(getAuthConfig()).resolves.toEqual({
      googleSignInEnabled: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(urlPath(url)).toMatch(/\/api\/v1\/auth\/config$/);
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
  });

  it("getAuthConfig throws a machine failure when the config request fails", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          type: "https://restaurant-pos.app/errors/internal",
          title: "Internal Server Error",
          status: 500,
        },
        500,
      ),
    );

    await expect(getAuthConfig()).rejects.toMatchObject({
      code: "authConfig.internal",
      status: 500,
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

  it("requestEmailChange POSTs the new address and current password with Bearer", async () => {
    setAccessToken("jwt-here");
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Sent" }));

    const result = await requestEmailChange("new@example.com", "Secret123!");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers as HeadersInit);
    expect(urlPath(url)).toMatch(/\/api\/v1\/auth\/request-email-change$/);
    expect(init.method).toBe("POST");
    expect(headers.get("Authorization")).toBe("Bearer jwt-here");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(init.body).toBe(
      JSON.stringify({
        newEmail: "new@example.com",
        currentPassword: "Secret123!",
      }),
    );
    expect(result).toEqual({ ok: true, data: { message: "Sent" } });
  });

  it("requestEmailChange maps a wrong password to the machine outcome", async () => {
    setAccessToken("jwt-here");
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          type: "https://restaurant-pos.app/errors/unauthorized",
          title: "Unauthorized",
          status: 401,
          detail: "Current password is incorrect.",
        },
        401,
      ),
    );

    const result = await requestEmailChange("new@example.com", "wrong");

    expectFailure(result, {
      code: "emailChange.unauthorized",
      status: 401,
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

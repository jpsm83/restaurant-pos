/**
 * Google verifier seam: configuration and claim trust rules, never Google.
 */
import { beforeEach, describe, it, expect, vi } from "vitest";

const verifyIdTokenMock = vi.hoisted(() => vi.fn());

vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    verifyIdToken(input: unknown) {
      return verifyIdTokenMock(input);
    }
  },
}));

import {
  createGoogleVerifier,
  GoogleCredentialError,
  toGoogleIdentity,
} from "../../src/auth/google.ts";

describe("createGoogleVerifier", () => {
  it("is unavailable when no client id is configured", () => {
    expect(createGoogleVerifier(undefined)).toBeNull();
    expect(createGoogleVerifier("   ")).toBeNull();
  });

  it("builds a verifier when a client id is configured", () => {
    expect(createGoogleVerifier("client-id.apps.googleusercontent.com")).toEqual(
      expect.any(Function),
    );
  });
});

describe("configured Google verifier", () => {
  beforeEach(() => {
    verifyIdTokenMock.mockReset();
  });

  it("verifies the ID token against the configured audience", async () => {
    verifyIdTokenMock.mockResolvedValue({
      getPayload: () => ({
        sub: "google-subject",
        email: "person@example.com",
        email_verified: true,
      }),
    });
    const verifier = createGoogleVerifier("client-id.apps.googleusercontent.com");

    await expect(verifier!("google-id-token")).resolves.toEqual({
      subject: "google-subject",
      email: "person@example.com",
    });
    expect(verifyIdTokenMock).toHaveBeenCalledWith({
      idToken: "google-id-token",
      audience: "client-id.apps.googleusercontent.com",
    });
  });

  it("refuses a token the library rejects (issuer, audience, signature, expiry)", async () => {
    verifyIdTokenMock.mockRejectedValue(
      new Error("Wrong recipient, payload audience doesn't match"),
    );
    const verifier = createGoogleVerifier("client-id.apps.googleusercontent.com");

    await expect(verifier!("google-id-token")).rejects.toThrow(
      GoogleCredentialError,
    );
  });
});

describe("toGoogleIdentity", () => {
  it("trusts a verified Google email and normalizes it", () => {
    expect(
      toGoogleIdentity({
        sub: " google-subject ",
        email: "  Person@Example.COM ",
        email_verified: true,
        given_name: " Pat ",
        family_name: " Lee ",
      }),
    ).toEqual({
      subject: "google-subject",
      email: "person@example.com",
      firstName: "Pat",
      lastName: "Lee",
    });
  });

  it("omits blank optional names", () => {
    expect(
      toGoogleIdentity({
        sub: "google-subject",
        email: "person@example.com",
        email_verified: true,
        given_name: "  ",
      }),
    ).toEqual({
      subject: "google-subject",
      email: "person@example.com",
    });
  });

  it.each([
    ["missing claims", undefined],
    ["missing subject", { email: "person@example.com", email_verified: true }],
    ["missing email", { sub: "google-subject", email_verified: true }],
    [
      "unverified email",
      { sub: "google-subject", email: "person@example.com", email_verified: false },
    ],
    [
      "email_verified absent",
      { sub: "google-subject", email: "person@example.com" },
    ],
  ])("refuses %s", (_label, claims) => {
    expect(() => toGoogleIdentity(claims)).toThrow(GoogleCredentialError);
  });
});

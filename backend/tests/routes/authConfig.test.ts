/**
 * GET /api/v1/auth/config — unauthenticated availability for auth surfaces.
 *
 * The endpoint mirrors the Google route's verifier source and must never carry
 * credentials, a client id, or an auth cookie.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/server.ts";
import type {
  GoogleIdentity,
  GoogleVerifier,
} from "../../src/auth/google.ts";

const identity: GoogleIdentity = {
  subject: "google-subject",
  email: "google-user@test.com",
  firstName: "Google",
  lastName: "User",
};

const verifyGoogle = vi.fn<GoogleVerifier>(async () => identity);

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

beforeAll(() => {
  if (!process.env.APP_BASE_URL?.trim()) {
    process.env.APP_BASE_URL = "http://127.0.0.1:3000";
  }
});

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function getConfig(googleVerifier: GoogleVerifier | null) {
  const app = await buildApp({
    logger: false,
    skipDb: true,
    googleVerifier,
  });
  apps.push(app);
  return app.inject({
    method: "GET",
    url: "/api/v1/auth/config",
  });
}

describe("GET /api/v1/auth/config", () => {
  it("reports Google sign-in enabled when the verifier exists", async () => {
    const response = await getConfig(verifyGoogle);

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.json()).toEqual({ googleSignInEnabled: true });
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("reports Google sign-in disabled when the verifier is absent", async () => {
    const response = await getConfig(null);

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.json()).toEqual({ googleSignInEnabled: false });
    expect(response.headers["set-cookie"]).toBeUndefined();
  });
});

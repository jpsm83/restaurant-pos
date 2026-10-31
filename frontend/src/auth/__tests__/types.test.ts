import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  AuthLoginSnapshot,
  AuthSession,
  AuthState,
  AuthStatus,
  AuthUser,
  GoogleAuthCredentials,
  LoginCredentials,
  SignupCredentials,
} from "../types";

describe("auth types", () => {
  it("AuthStatus matches the four UI lifecycle literals", () => {
    expectTypeOf<AuthStatus>().toEqualTypeOf<
      "idle" | "loading" | "authenticated" | "unauthenticated"
    >();
  });

  it("AuthSession is the User-only session payload", () => {
    const user: AuthUser = {
      id: "u1",
      email: "c@example.com",
      type: "user",
      mode: "customer",
      languagePreference: "es",
      role: "Customer",
    };

    expectTypeOf(user).toMatchTypeOf<AuthSession>();
    expectTypeOf<AuthSession>().toEqualTypeOf<AuthUser>();
    expect(user.mode).toBe("customer");
    expect(user.languagePreference).toBe("es");
  });

  it("AuthState ties user, status, and optional error", () => {
    const state: AuthState = {
      user: null,
      status: "unauthenticated",
      error: null,
    };
    expect(state.status).toBe("unauthenticated");

    const authed: AuthState = {
      user: {
        id: "u1",
        email: "o@example.com",
        type: "user",
        mode: "business",
        role: "Manager",
      },
      status: "authenticated",
      error: null,
    };
    expect(authed.user?.mode).toBe("business");
  });

  it("AuthLoginSnapshot allows token + nullable user", () => {
    const snap: AuthLoginSnapshot = {
      accessToken: "jwt",
      user: null,
    };
    expect(snap.user).toBeNull();

    const withUser: AuthLoginSnapshot = {
      user: {
        id: "u1",
        email: "x@example.com",
        type: "user",
        role: "Employee",
      },
    };
    expect(withUser.user?.email).toBe("x@example.com");
  });

  it("LoginCredentials and SignupCredentials carry required auth fields", () => {
    const login: LoginCredentials = { email: "a@b.co", password: "secret" };
    expect(login.email).toMatch(/@/);

    const signup: SignupCredentials = {
      email: "a@b.co",
      password: "secret",
      firstName: "A",
      privacyAccepted: true,
    };
    expect(signup.firstName).toBe("A");
  });

  it("GoogleAuthCredentials carries the optional acceptance proof", () => {
    const google: GoogleAuthCredentials = {
      credential: "google-id-token",
      privacyAccepted: true,
    };
    expect(google.privacyAccepted).toBe(true);
  });
});

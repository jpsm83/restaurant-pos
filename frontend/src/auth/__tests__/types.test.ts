import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  AuthBusiness,
  AuthLoginSnapshot,
  AuthSession,
  AuthState,
  AuthStatus,
  AuthUser,
  LoginCredentials,
  SignupCredentials,
} from "../types";

describe("auth types", () => {
  it("AuthStatus matches the four UI lifecycle literals", () => {
    expectTypeOf<AuthStatus>().toEqualTypeOf<
      "idle" | "loading" | "authenticated" | "unauthenticated"
    >();
  });

  it("AuthSession narrows on type for business vs user payloads", () => {
    const business: AuthBusiness = {
      id: "b1",
      email: "t@example.com",
      type: "business",
      role: "Tenant",
    };
    const user: AuthUser = {
      id: "u1",
      email: "c@example.com",
      type: "user",
      role: "Customer",
    };

    expectTypeOf(business).toMatchTypeOf<AuthSession>();
    expectTypeOf(user).toMatchTypeOf<AuthSession>();

    function assertNarrowing(s: AuthSession) {
      if (s.type === "business") {
        expectTypeOf(s).toEqualTypeOf<AuthBusiness>();
        expect(s.role).toBe("Tenant");
      } else {
        expectTypeOf(s).toEqualTypeOf<AuthUser>();
        expect(s.type).toBe("user");
      }
    }

    assertNarrowing(business);
    assertNarrowing(user);
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
        id: "b1",
        email: "o@example.com",
        type: "business",
        role: "Tenant",
      },
      status: "authenticated",
      error: null,
    };
    expect(authed.user?.type).toBe("business");
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
    };
    expect(signup.firstName).toBe("A");
  });
});

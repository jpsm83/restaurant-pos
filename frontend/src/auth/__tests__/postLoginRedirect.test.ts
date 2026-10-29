/**
 * Tests for `postLoginRedirect.ts` — shared auth landing and safe return paths.
 */
import { describe, expect, it } from "vitest";
import type { AuthSession } from "../types";
import {
  authPathWithReturnTo,
  getPostLoginDestination,
  getReturnToParam,
  safeReturnTo,
} from "../postLoginRedirect";

const session: AuthSession = {
  id: "u1",
  email: "u@test.local",
  type: "user",
  role: "Customer",
};

const dashboard = "/u1/customer/dashboard";

describe("safeReturnTo", () => {
  it.each([
    "/business/64a1b2c3d4e5f67890123456/dashboard",
    "/u1/customer/favorites?tab=all#top",
    "/",
  ])("accepts same-origin path %s", (path) => {
    expect(safeReturnTo(path)).toBe(path);
  });

  it.each([
    ["null", null],
    ["empty", ""],
    ["relative path", "customer/dashboard"],
    ["protocol-relative URL", "//evil.example/login"],
    ["absolute URL", "https://evil.example/login"],
    ["scheme", "javascript:alert(1)"],
    ["mailto scheme", "mailto:help@example.com"],
    ["backslash host", "/\\evil.example"],
    ["control character", "/dashboard\nSet-Cookie: x"],
    ["login", "/login"],
    ["login with query", "/login?returnTo=/u1/customer/dashboard"],
    ["signup", "/signup"],
    ["forgot password", "/forgot-password"],
    ["reset password", "/reset-password?token=abc"],
    ["confirm email", "/confirm-email"],
    ["request email confirmation", "/request-email-confirmation"],
    ["retired business register", "/business/register"],
    ["retired business signup", "/business/signup"],
    ["case variant", "/LOGIN"],
    ["trailing slash", "/login/"],
    ["encoded login", "/%6cogin"],
    ["encoded protocol-relative", "/%2f%2fevil.example"],
    ["encoded control character", "/%09/evil.example"],
    ["encoded backslash host", "/%5C%5Cevil.example"],
  ])("rejects %s", (_name, candidate) => {
    expect(safeReturnTo(candidate)).toBeNull();
  });
});

describe("getReturnToParam", () => {
  it("reads and decodes the returnTo parameter", () => {
    expect(
      getReturnToParam("?returnTo=%2Fu1%2Fcustomer%2Ffavorites%3Ftab%3Dall"),
    ).toBe("/u1/customer/favorites?tab=all");
  });

  it("returns null when absent", () => {
    expect(getReturnToParam("?foo=bar")).toBeNull();
  });
});

describe("authPathWithReturnTo", () => {
  it("attaches only safe return paths", () => {
    expect(
      authPathWithReturnTo("/login", "/u1/customer/favorites?tab=all"),
    ).toBe("/login?returnTo=%2Fu1%2Fcustomer%2Ffavorites%3Ftab%3Dall");
  });

  it("leaves auth links plain for unsafe paths", () => {
    expect(authPathWithReturnTo("/signup", "//evil.example")).toBe("/signup");
    expect(authPathWithReturnTo("/login", "/login")).toBe("/login");
    expect(authPathWithReturnTo("/signup", null)).toBe("/signup");
  });
});

describe("getPostLoginDestination", () => {
  const table: {
    name: string;
    session: AuthSession;
    returnTo?: string | null;
    expected: string;
  }[] = [
    {
      name: "user without employee link",
      session,
      expected: dashboard,
    },
    {
      name: "employee-linked user also stays on Customer",
      session: {
        ...session,
        employeeId: "e1",
        businessId: "biz1",
        canLogAsEmployee: true,
        role: "Manager",
        mode: "customer",
      },
      expected: dashboard,
    },
    {
      name: "owner with business mode also stays on Customer",
      session: { ...session, mode: "business" },
      expected: dashboard,
    },
    {
      name: "safe return path is honoured",
      session,
      returnTo: "/u1/customer/favorites?tab=all",
      expected: "/u1/customer/favorites?tab=all",
    },
    {
      name: "external return path falls back to Customer dashboard",
      session,
      returnTo: "https://evil.example",
      expected: dashboard,
    },
    {
      name: "auth destination return path falls back to Customer dashboard",
      session,
      returnTo: "/login",
      expected: dashboard,
    },
  ];

  it.each(table)("$name → $expected", ({ session: user, returnTo, expected }) => {
    expect(getPostLoginDestination(user, returnTo)).toBe(expected);
  });
});

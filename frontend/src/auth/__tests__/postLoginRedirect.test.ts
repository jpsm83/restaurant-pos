/**
 * Tests for `postLoginRedirect.ts` — shared auth landing and safe return paths.
 */
import { describe, expect, it } from "vitest";
import {
  authPathWithReturnTo,
  getPostLoginDestination,
  getReturnToParam,
  safeReturnTo,
} from "../postLoginRedirect";

const dashboard = "/dashboard";

describe("safeReturnTo", () => {
  it.each([
    "/business/64a1b2c3d4e5f67890123456/dashboard",
    "/favorites?tab=all#top",
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
    ["login with query", "/login?returnTo=/dashboard"],
    ["signup", "/signup"],
    ["forgot password", "/forgot-password"],
    ["reset password", "/reset-password?token=abc"],
    ["confirm email", "/confirm-email"],
    ["confirm email change", "/confirm-email-change?token=abc"],
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
      getReturnToParam("?returnTo=%2Ffavorites%3Ftab%3Dall"),
    ).toBe("/favorites?tab=all");
  });

  it("returns null when absent", () => {
    expect(getReturnToParam("?foo=bar")).toBeNull();
  });
});

describe("authPathWithReturnTo", () => {
  it("attaches only safe return paths", () => {
    expect(
      authPathWithReturnTo("/login", "/favorites?tab=all"),
    ).toBe("/login?returnTo=%2Ffavorites%3Ftab%3Dall");
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
    returnTo?: string | null;
    expected: string;
  }[] = [
    {
      name: "default landing",
      expected: dashboard,
    },
    {
      name: "safe return path is honoured",
      returnTo: "/favorites?tab=all",
      expected: "/favorites?tab=all",
    },
    {
      name: "external return path falls back to Customer dashboard",
      returnTo: "https://evil.example",
      expected: dashboard,
    },
    {
      name: "auth destination return path falls back to Customer dashboard",
      returnTo: "/login",
      expected: dashboard,
    },
  ];

  it.each(table)("$name → $expected", ({ returnTo, expected }) => {
    expect(getPostLoginDestination(returnTo)).toBe(expected);
  });
});

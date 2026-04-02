/**
 * Tests for `postLoginRedirect.ts` — `getPostLoginDestination` vs session shape.
 */
import { describe, expect, it } from "vitest";
import type { AuthSession } from "./types";
import { getPostLoginDestination } from "./postLoginRedirect";

describe("getPostLoginDestination", () => {
  const table: { name: string; session: AuthSession; expected: string }[] = [
    {
      name: "business tenant",
      session: {
        id: "b1",
        email: "b@test.local",
        type: "business",
      },
      expected: "/business/b1/dashboard",
    },
    {
      name: "user without employee link",
      session: {
        id: "u1",
        email: "u@test.local",
        type: "user",
      },
      expected: "/u1/customer/dashboard",
    },
    {
      name: "user with employee link (mode selection)",
      session: {
        id: "u1",
        email: "u@test.local",
        type: "user",
        employeeId: "e1",
        businessId: "biz1",
        canLogAsEmployee: true,
      },
      expected: "/u1/mode",
    },
  ];

  it.each(table)("$name → $expected", ({ session, expected }) => {
    expect(getPostLoginDestination(session)).toBe(expected);
  });
});

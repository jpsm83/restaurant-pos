/**
 * Tests for `postLoginRedirect.ts` — the signed-in User always lands on Customer.
 */
import { describe, expect, it } from "vitest";
import type { AuthSession } from "../types";
import { getPostLoginDestination } from "../postLoginRedirect";

describe("getPostLoginDestination", () => {
  const table: { name: string; session: AuthSession; expected: string }[] = [
    {
      name: "user without employee link",
      session: {
        id: "u1",
        email: "u@test.local",
        type: "user",
        role: "Customer",
      },
      expected: "/u1/customer/dashboard",
    },
    {
      name: "employee-linked user also stays on Customer",
      session: {
        id: "u1",
        email: "u@test.local",
        type: "user",
        employeeId: "e1",
        businessId: "biz1",
        canLogAsEmployee: true,
        role: "Manager",
        mode: "customer",
      },
      expected: "/u1/customer/dashboard",
    },
    {
      name: "owner with business mode also stays on Customer",
      session: {
        id: "u1",
        email: "owner@test.local",
        type: "user",
        mode: "business",
        role: "Customer",
      },
      expected: "/u1/customer/dashboard",
    },
  ];

  it.each(table)("$name → $expected", ({ session, expected }) => {
    expect(getPostLoginDestination(session)).toBe(expected);
  });
});

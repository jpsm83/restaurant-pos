import { describe, expect, it } from "vitest";
import {
  canonicalBusinessDashboardPath,
  canonicalUserCustomerPath,
  canonicalUserEmployeePath,
  canonicalUserModePath,
  isLikelyMongoObjectIdString,
  matchesSessionBusinessId,
  matchesSessionUserId,
} from "./sessionPathGuards";

describe("sessionPathGuards", () => {
  describe("isLikelyMongoObjectIdString", () => {
    it("accepts 24 hex chars", () => {
      expect(isLikelyMongoObjectIdString("507f1f77bcf86cd799439011")).toBe(true);
    });
    it("rejects short ids", () => {
      expect(isLikelyMongoObjectIdString("u1")).toBe(false);
    });
  });

  describe("matchesSessionUserId", () => {
    it("matches user type and id", () => {
      expect(
        matchesSessionUserId("abc", {
          id: "abc",
          email: "u@test.local",
          type: "user",
        }),
      ).toBe(true);
    });
    it("fails for business session", () => {
      expect(
        matchesSessionUserId("abc", {
          id: "abc",
          email: "b@test.local",
          type: "business",
        }),
      ).toBe(false);
    });
  });

  describe("matchesSessionBusinessId", () => {
    it("matches business type and id", () => {
      expect(
        matchesSessionBusinessId("biz1", {
          id: "biz1",
          email: "biz@test.local",
          type: "business",
        }),
      ).toBe(true);
    });
  });

  describe("canonical paths", () => {
    it("builds user paths", () => {
      expect(
        canonicalUserCustomerPath({
          id: "u1",
          email: "u@test.local",
          type: "user",
        }),
      ).toBe("/u1/customer");
      expect(
        canonicalUserModePath({ id: "u1", email: "u@test.local", type: "user" }),
      ).toBe("/u1/mode");
      expect(
        canonicalUserEmployeePath({
          id: "u1",
          email: "u@test.local",
          type: "user",
        }),
      ).toBe("/u1/employee");
    });
    it("builds business path", () => {
      expect(
        canonicalBusinessDashboardPath({
          id: "b1",
          email: "b@test.local",
          type: "business",
        }),
      ).toBe("/business/b1");
    });
  });
});

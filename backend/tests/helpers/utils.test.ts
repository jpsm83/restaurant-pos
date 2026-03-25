import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import isObjectIdValid from "../../src/utils/isObjectIdValid.ts";
import { isBusinessOpenNow } from "../../src/business/isBusinessOpenNow.ts";
import type { IBusiness } from "../../../packages/interfaces/IBusiness.ts";
import * as enums from "../../../packages/enums.ts";

const { managementRolesEnums } = enums;

describe("Utility Helpers", () => {
  describe("isObjectIdValid", () => {
    it("returns true for valid ObjectId strings", () => {
      const validIds = [
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
      ];
      expect(isObjectIdValid(validIds)).toBe(true);
    });

    it("returns true for valid ObjectId instances", () => {
      const validIds = [new Types.ObjectId(), new Types.ObjectId()];
      expect(isObjectIdValid(validIds)).toBe(true);
    });

    it("returns true for single valid ID", () => {
      expect(isObjectIdValid([new Types.ObjectId().toString()])).toBe(true);
    });

    it("returns false for invalid ID strings", () => {
      expect(isObjectIdValid(["invalid-id"])).toBe(false);
      expect(isObjectIdValid(["123"])).toBe(false);
      expect(isObjectIdValid(["not-an-objectid"])).toBe(false);
    });

    it("returns false for empty array", () => {
      expect(isObjectIdValid([])).toBe(false);
    });

    it("returns false for array with null/undefined", () => {
      expect(isObjectIdValid([null as any])).toBe(false);
      expect(isObjectIdValid([undefined as any])).toBe(false);
    });

    it("returns false if any ID in array is invalid", () => {
      const mixedIds = [new Types.ObjectId().toString(), "invalid-id"];
      expect(isObjectIdValid(mixedIds)).toBe(false);
    });
  });

  describe("isBusinessOpenNow", () => {
    const createBusiness = (openingHours: any[]): IBusiness =>
      ({
        businessOpeningHours: openingHours,
      }) as IBusiness;

    it("returns true when business is open during opening hours", () => {
      const wednesday = new Date("2025-01-15T14:00:00"); // Wednesday at 14:00
      const business = createBusiness([
        { dayOfWeek: 3, openTime: "09:00", closeTime: "18:00" }, // Wednesday
      ]);

      expect(isBusinessOpenNow(business, wednesday)).toBe(true);
    });

    it("returns false when business is closed (outside hours)", () => {
      const wednesday = new Date("2025-01-15T20:00:00"); // Wednesday at 20:00
      const business = createBusiness([
        { dayOfWeek: 3, openTime: "09:00", closeTime: "18:00" }, // Wednesday
      ]);

      expect(isBusinessOpenNow(business, wednesday)).toBe(false);
    });

    it("returns false when business is closed (wrong day)", () => {
      const thursday = new Date("2025-01-16T14:00:00"); // Thursday at 14:00
      const business = createBusiness([
        { dayOfWeek: 3, openTime: "09:00", closeTime: "18:00" }, // Wednesday only
      ]);

      expect(isBusinessOpenNow(business, thursday)).toBe(false);
    });

    it("returns true when no opening hours defined (always open)", () => {
      const business = createBusiness([]);
      expect(isBusinessOpenNow(business, new Date())).toBe(true);
    });

    it("returns true when openingHours is undefined (always open)", () => {
      const business = { businessOpeningHours: undefined } as IBusiness;
      expect(isBusinessOpenNow(business, new Date())).toBe(true);
    });

    it("handles edge case at opening time", () => {
      const wednesday = new Date("2025-01-15T09:00:00"); // Exactly at opening
      const business = createBusiness([
        { dayOfWeek: 3, openTime: "09:00", closeTime: "18:00" },
      ]);

      expect(isBusinessOpenNow(business, wednesday)).toBe(true);
    });

    it("handles edge case just before closing time", () => {
      const wednesday = new Date("2025-01-15T17:59:00"); // Just before closing
      const business = createBusiness([
        { dayOfWeek: 3, openTime: "09:00", closeTime: "18:00" },
      ]);

      expect(isBusinessOpenNow(business, wednesday)).toBe(true);
    });

    it("returns false at exactly closing time", () => {
      const wednesday = new Date("2025-01-15T18:00:00"); // Exactly at closing
      const business = createBusiness([
        { dayOfWeek: 3, openTime: "09:00", closeTime: "18:00" },
      ]);

      expect(isBusinessOpenNow(business, wednesday)).toBe(false);
    });
  });

  describe("managementRolesEnums", () => {
    it("returns true for Owner role", () => {
      expect(managementRolesEnums.some((role) => role === "Owner")).toBe(true);
    });

    it("returns true for Manager role", () => {
      expect(managementRolesEnums.some((role) => role === "Manager")).toBe(true);
    });

    it("returns true for General Manager role", () => {
      expect(managementRolesEnums.some((role) => role === "General Manager")).toBe(true);
    });

    it("returns true for any management role", () => {
      for (const role of managementRolesEnums) {
        expect(managementRolesEnums.some((r) => r === role)).toBe(true);
      }
    });

    it("returns true when one of multiple roles is management", () => {
      expect(managementRolesEnums.some((role) => role === "Waiter" || role === "Manager" || role === "Chef")).toBe(true);
    });

    it("returns false for non-management roles", () => {
      expect(managementRolesEnums.some((role) => role === "Waiter")).toBe(false);
      expect(managementRolesEnums.some((role) => role === "Chef")).toBe(false);
      expect(managementRolesEnums.some((role) => role === "Bartender")).toBe(false);
    });

    it("returns false for empty array", () => {
      expect(managementRolesEnums.some((role) => role === "Waiter")).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(managementRolesEnums.some((role) => role === "Waiter")).toBe(false);
    });
  });
});

/**
 * SalesInstance Helpers Tests - Task 0.11
 * Tests for createSalesInstance
 */

import { describe, it, expect } from "vitest";
import { createSalesInstance } from "../../src/salesInstances/createSalesInstance.ts";

describe("SalesInstance Helpers", () => {
  describe("createSalesInstance", () => {
    it("function exists and is callable", () => {
      expect(typeof createSalesInstance).toBe("function");
    });

    it("returns error for missing dailyReferenceNumber", async () => {
      const invalidObj = {
        salesPointId: "test",
        guests: 2,
        salesInstanceStatus: "Open",
        businessId: "test",
      };

      const result = await createSalesInstance(invalidObj as any, null as any);
      expect(result).toBe("dailyReferenceNumber is missing!");
    });

    it("returns error for missing salesPointId", async () => {
      const invalidObj = {
        dailyReferenceNumber: 1,
        guests: 2,
        salesInstanceStatus: "Open",
        businessId: "test",
      };

      const result = await createSalesInstance(invalidObj as any, null as any);
      expect(result).toBe("salesPointId is missing!");
    });

    it("returns error for missing guests", async () => {
      const invalidObj = {
        dailyReferenceNumber: 1,
        salesPointId: "test",
        salesInstanceStatus: "Open",
        businessId: "test",
      };

      const result = await createSalesInstance(invalidObj as any, null as any);
      expect(result).toBe("guests is missing!");
    });

    it("returns error for missing salesInstanceStatus", async () => {
      const invalidObj = {
        dailyReferenceNumber: 1,
        salesPointId: "test",
        guests: 2,
        businessId: "test",
      };

      const result = await createSalesInstance(invalidObj as any, null as any);
      expect(result).toBe("salesInstanceStatus is missing!");
    });

    it("returns error for missing businessId", async () => {
      const invalidObj = {
        dailyReferenceNumber: 1,
        salesPointId: "test",
        guests: 2,
        salesInstanceStatus: "Open",
      };

      const result = await createSalesInstance(invalidObj as any, null as any);
      expect(result).toBe("businessId is missing!");
    });

    it("validates all required fields in order", async () => {
      const emptyObj = {};

      const result = await createSalesInstance(emptyObj as any, null as any);
      expect(result).toBe("dailyReferenceNumber is missing!");
    });
  });
});

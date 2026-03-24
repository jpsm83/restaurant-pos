/**
 * Reservation Helpers Tests - Task 0.9
 * Tests for reservation customer communication flows
 */

import { describe, it, expect } from "vitest";

describe("Reservation Helpers", () => {
  describe("sendReservationPendingFlow", () => {
    it("function exists and is callable", async () => {
      const { sendReservationPendingFlow } = await import(
        "../../src/reservations/sendReservationCustomerFlow.ts"
      );
      expect(typeof sendReservationPendingFlow).toBe("function");
    });
  });

  describe("sendReservationDecisionFlow", () => {
    it("function exists and is callable", async () => {
      const { sendReservationDecisionFlow } = await import(
        "../../src/reservations/sendReservationCustomerFlow.ts"
      );
      expect(typeof sendReservationDecisionFlow).toBe("function");
    });
  });
});

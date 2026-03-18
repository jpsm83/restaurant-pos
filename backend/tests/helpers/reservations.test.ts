/**
 * Reservation Helpers Tests - Task 0.9
 * Tests for buildReservationMessage, sendReservationPendingFlow, sendReservationDecisionFlow
 */

import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { buildReservationMessage } from "../../src/reservations/buildReservationMessage.js";

describe("Reservation Helpers", () => {
  const reservationId = new Types.ObjectId();

  describe("buildReservationMessage", () => {
    it("formats message correctly with all fields", () => {
      const reservationStart = new Date("2025-01-20T19:00:00");
      
      const message = buildReservationMessage({
        reservationId,
        status: "Confirmed",
        reservationStart,
        guestCount: 4,
        description: "Birthday dinner",
      });

      expect(message).toContain(`Ref ${reservationId.toString()}`);
      expect(message).toContain("Status: Confirmed");
      expect(message).toContain("Guests: 4");
      expect(message).toContain("Reason: Birthday dinner");
    });

    it("formats message without description", () => {
      const reservationStart = new Date("2025-01-20T19:00:00");
      
      const message = buildReservationMessage({
        reservationId,
        status: "Pending",
        reservationStart,
        guestCount: 2,
      });

      expect(message).toContain("Status: Pending");
      expect(message).toContain("Guests: 2");
      expect(message).not.toContain("Reason:");
    });

    it("handles string reservationId", () => {
      const stringId = "abc123";
      
      const message = buildReservationMessage({
        reservationId: stringId,
        status: "Cancelled",
        reservationStart: new Date(),
        guestCount: 6,
      });

      expect(message).toContain("Ref abc123");
      expect(message).toContain("Status: Cancelled");
    });

    it("formats Pending status correctly", () => {
      const message = buildReservationMessage({
        reservationId,
        status: "Pending",
        reservationStart: new Date(),
        guestCount: 2,
      });
      
      expect(message).toContain("Status: Pending");
    });

    it("formats Confirmed status correctly", () => {
      const message = buildReservationMessage({
        reservationId,
        status: "Confirmed",
        reservationStart: new Date(),
        guestCount: 4,
      });
      
      expect(message).toContain("Status: Confirmed");
    });

    it("formats Cancelled status correctly", () => {
      const message = buildReservationMessage({
        reservationId,
        status: "Cancelled",
        reservationStart: new Date(),
        guestCount: 3,
      });
      
      expect(message).toContain("Status: Cancelled");
    });

    it("formats Arrived status correctly", () => {
      const message = buildReservationMessage({
        reservationId,
        status: "Arrived",
        reservationStart: new Date(),
        guestCount: 5,
      });
      
      expect(message).toContain("Status: Arrived");
    });

    it("includes guest count correctly", () => {
      const message = buildReservationMessage({
        reservationId,
        status: "Confirmed",
        reservationStart: new Date(),
        guestCount: 10,
      });
      
      expect(message).toContain("Guests: 10");
    });

    it("includes date/time in message", () => {
      const message = buildReservationMessage({
        reservationId,
        status: "Confirmed",
        reservationStart: new Date("2025-06-15T20:30:00"),
        guestCount: 2,
      });
      
      expect(message).toContain("When:");
    });
  });

  describe("sendReservationPendingFlow", () => {
    it("function exists and is callable", async () => {
      const { sendReservationPendingFlow } = await import(
        "../../src/reservations/sendReservationCustomerFlow.js"
      );
      expect(typeof sendReservationPendingFlow).toBe("function");
    });
  });

  describe("sendReservationDecisionFlow", () => {
    it("function exists and is callable", async () => {
      const { sendReservationDecisionFlow } = await import(
        "../../src/reservations/sendReservationCustomerFlow.js"
      );
      expect(typeof sendReservationDecisionFlow).toBe("function");
    });
  });
});

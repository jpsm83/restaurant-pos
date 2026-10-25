/**
 * Deliver reservation pending and decided on the rail without undoing the
 * reservation (issue #163).
 *
 * Caller-regression seam: the one delivery operation
 * `notificationService.createAndDeliver` (the same rail a hand-created
 * notification uses) is mocked, and the email channel is spied. The tests
 * assert that RESERVATION_PENDING uses that delivery operation once for the
 * customer and once for the managers already resolved for that event; that
 * RESERVATION_DECIDED uses it once for the customer; that the stored text and
 * Info severity are the ones the caller already supplies; that the email copy
 * keeps using the email rail; that a repeat dispatch inside the idempotency
 * window delivers only once; that operational in-app off stores and pushes
 * nothing; and that a failed in-app delivery leaves the reservation in place.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import User from "../../src/models/user.ts";
import Employee from "../../src/models/employee.ts";
import Reservation from "../../src/models/reservation.ts";
import dispatchEvent from "../../src/communications/dispatchEvent.ts";
import notificationService from "../../src/communications/services/notificationService.ts";
import emailChannel from "../../src/communications/channels/emailChannel.ts";
import buildReservationTemplate from "../../src/communications/templates/reservationTemplate.ts";
import { sendReservationPendingFlow } from "../../src/reservations/sendReservationCustomerFlow.ts";

const validAddress = {
  country: "USA",
  state: "CA",
  city: "Los Angeles",
  street: "Main St",
  buildingNumber: "123",
  postCode: "90001",
};

const createTestUser = async (prefix: string) => {
  const unique = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return User.create({
    personalDetails: {
      username: `${unique}-user`,
      email: `${unique}@test.com`,
      password: "hashedpassword",
      firstName: "Test",
      lastName: "User",
      phoneNumber: "1234567890",
      birthDate: new Date("1990-01-01"),
      gender: "Man",
      nationality: "USA",
      idType: "National ID",
      idNumber: `ID-${unique}`,
      address: validAddress,
    },
    allUserRoles: ["Customer"],
  });
};

const createOnDutyManager = async (businessId: Types.ObjectId, suffix: string) =>
  Employee.create({
    businessId,
    userId: new Types.ObjectId(),
    taxNumber: `MGR-${suffix}-${Date.now()}`,
    joinDate: new Date(),
    vacationDaysPerYear: 20,
    vacationDaysLeft: 20,
    allEmployeeRoles: ["Manager"],
    currentShiftRole: "Manager",
    onDuty: true,
    active: true,
  });

/** A resolved delivery result so the in-app channel's success path runs. */
const fakeDelivered = (userId: Types.ObjectId) => ({
  notificationId: new Types.ObjectId(),
  recipientUserIds: [userId],
  recipientCount: 1,
  emittedLiveEvent: true,
});

const withEnv = async (
  overrides: Record<string, string | undefined>,
  run: () => Promise<void>,
) => {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Reservation pending and decided on the rail (#163)", () => {
  it("pending delivers once to the customer and once to the managers already resolved", async () => {
    await withEnv({ COMMUNICATIONS_EMAIL_ENABLED: "false" }, async () => {
      const userId = new Types.ObjectId();
      const businessId = new Types.ObjectId();
      const manager = await createOnDutyManager(businessId, "pending");
      const deliverSpy = vi
        .spyOn(notificationService, "createAndDeliver")
        .mockResolvedValue(fakeDelivered(userId));

      const payload = {
        businessId,
        userId,
        reservationId: new Types.ObjectId(),
        reservationStart: new Date("2026-03-23T20:00:00.000Z"),
        guestCount: 3,
        description: "Window seat",
      };
      const result = await dispatchEvent("RESERVATION_PENDING", payload, {
        fireAndForget: true,
      });

      expect(result.success).toBe(true);
      // One delivery to the customer and one delivery to the managers.
      expect(deliverSpy).toHaveBeenCalledTimes(2);

      const baseMessage = buildReservationTemplate({
        reservationId: payload.reservationId,
        status: "Pending",
        reservationStart: payload.reservationStart,
        guestCount: payload.guestCount,
        description: payload.description,
      });

      const customerCall = deliverSpy.mock.calls.find(
        (call) => (call[0].recipients.customerUserIds?.length ?? 0) > 0,
      );
      const managerCall = deliverSpy.mock.calls.find(
        (call) => (call[0].recipients.employeeIds?.length ?? 0) > 0,
      );

      // Customer delivery: the ordering customer only, caller's text and Info.
      expect(customerCall).toBeDefined();
      expect(customerCall?.[0].recipients.customerUserIds?.map(String)).toEqual([
        String(userId),
      ]);
      expect(customerCall?.[0].recipients.employeeIds ?? []).toEqual([]);
      expect(customerCall?.[0].message).toBe(
        `${baseMessage}\n\nYour reservation is pending approval.`,
      );
      expect(customerCall?.[0].notificationType).toBe("Info");
      expect(String(customerCall?.[0].businessId)).toBe(String(businessId));

      // Manager delivery: the managers already resolved for that event.
      expect(managerCall).toBeDefined();
      expect(managerCall?.[0].recipients.employeeIds?.map(String)).toEqual([
        String(manager._id),
      ]);
      expect(managerCall?.[0].recipients.customerUserIds ?? []).toEqual([]);
      expect(managerCall?.[0].message).toBe(
        `${baseMessage}\n\nAction required: approve or reject this reservation.`,
      );
      expect(managerCall?.[0].notificationType).toBe("Info");
    });
  });

  it("decided delivers once, to the customer only, with the caller's text and Info severity", async () => {
    await withEnv({ COMMUNICATIONS_EMAIL_ENABLED: "false" }, async () => {
      const userId = new Types.ObjectId();
      const businessId = new Types.ObjectId();
      const deliverSpy = vi
        .spyOn(notificationService, "createAndDeliver")
        .mockResolvedValue(fakeDelivered(userId));

      const payload = {
        businessId,
        userId,
        reservationId: new Types.ObjectId(),
        reservationStart: new Date("2026-03-23T20:00:00.000Z"),
        guestCount: 2,
        description: "Birthday",
        status: "Confirmed" as const,
      };
      const result = await dispatchEvent("RESERVATION_DECIDED", payload, {
        fireAndForget: true,
      });

      expect(result.success).toBe(true);
      expect(deliverSpy).toHaveBeenCalledTimes(1);

      const input = deliverSpy.mock.calls[0][0];
      // Customer only: no employee recipients join this delivery.
      expect(input.recipients.customerUserIds?.map(String)).toEqual([
        String(userId),
      ]);
      expect(input.recipients.employeeIds ?? []).toEqual([]);
      expect(input.recipients.employeeUserIds ?? []).toEqual([]);
      // The stored text and Info severity are the ones the caller supplies.
      expect(input.message).toBe(
        buildReservationTemplate({
          reservationId: payload.reservationId,
          status: payload.status,
          reservationStart: payload.reservationStart,
          guestCount: payload.guestCount,
          description: payload.description,
        }),
      );
      expect(input.notificationType).toBe("Info");
      expect(String(input.businessId)).toBe(String(businessId));
    });
  });

  it("keeps the pending email copy on the email rail, unchanged by this delivery", async () => {
    await withEnv({ COMMUNICATIONS_EMAIL_ENABLED: "true" }, async () => {
      const customer = await createTestUser("reservation-email-rail");
      const businessId = new Types.ObjectId();
      const deliverSpy = vi
        .spyOn(notificationService, "createAndDeliver")
        .mockResolvedValue(fakeDelivered(customer._id));
      const emailSpy = vi.spyOn(emailChannel, "send").mockResolvedValue({
        channel: "email",
        success: true,
        sentCount: 1,
      });

      const payload = {
        businessId,
        userId: customer._id,
        reservationId: new Types.ObjectId(),
        reservationStart: new Date("2026-03-23T20:00:00.000Z"),
        guestCount: 4,
        description: "Business lunch",
      };
      await dispatchEvent("RESERVATION_PENDING", payload, {
        fireAndForget: true,
      });

      const baseMessage = buildReservationTemplate({
        reservationId: payload.reservationId,
        status: "Pending",
        reservationStart: payload.reservationStart,
        guestCount: payload.guestCount,
        description: payload.description,
      });

      // The email copy still rides the email rail with the reservation text.
      expect(emailSpy).toHaveBeenCalledTimes(1);
      const emailInput = emailSpy.mock.calls[0][0];
      expect(emailInput.to).toBe(customer.personalDetails.email);
      expect(emailInput.subject).toBe(
        `Reservation request received - Ref ${payload.reservationId.toString()}`,
      );
      expect(emailInput.text).toBe(baseMessage);
      // The in-app rail still delivers to the customer alongside the email.
      expect(deliverSpy).toHaveBeenCalled();
    });
  });

  it("keeps the decided email copy on the email rail, unchanged by this delivery", async () => {
    await withEnv({ COMMUNICATIONS_EMAIL_ENABLED: "true" }, async () => {
      const customer = await createTestUser("reservation-decided-email");
      const businessId = new Types.ObjectId();
      const deliverSpy = vi
        .spyOn(notificationService, "createAndDeliver")
        .mockResolvedValue(fakeDelivered(customer._id));
      const emailSpy = vi.spyOn(emailChannel, "send").mockResolvedValue({
        channel: "email",
        success: true,
        sentCount: 1,
      });

      const payload = {
        businessId,
        userId: customer._id,
        reservationId: new Types.ObjectId(),
        reservationStart: new Date("2026-03-23T20:00:00.000Z"),
        guestCount: 2,
        status: "Cancelled" as const,
      };
      await dispatchEvent("RESERVATION_DECIDED", payload, {
        fireAndForget: true,
      });

      const message = buildReservationTemplate({
        reservationId: payload.reservationId,
        status: payload.status,
        reservationStart: payload.reservationStart,
        guestCount: payload.guestCount,
      });

      // The decided email copy still rides the email rail with the decision text.
      expect(emailSpy).toHaveBeenCalledTimes(1);
      const emailInput = emailSpy.mock.calls[0][0];
      expect(emailInput.to).toBe(customer.personalDetails.email);
      expect(emailInput.subject).toBe(
        `Reservation cancelled - Ref ${payload.reservationId.toString()}`,
      );
      expect(emailInput.text).toBe(message);
      // The in-app rail still delivers to the customer alongside the email.
      expect(deliverSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("delivers only one notification for a repeat decided dispatch inside the idempotency window", async () => {
    await withEnv({ COMMUNICATIONS_EMAIL_ENABLED: "false" }, async () => {
      const userId = new Types.ObjectId();
      const businessId = new Types.ObjectId();
      const deliverSpy = vi
        .spyOn(notificationService, "createAndDeliver")
        .mockResolvedValue(fakeDelivered(userId));

      const payload = {
        businessId,
        userId,
        reservationId: new Types.ObjectId(),
        reservationStart: new Date("2026-03-23T20:00:00.000Z"),
        guestCount: 2,
        status: "Confirmed" as const,
      };
      const options = {
        fireAndForget: true as const,
        idempotencyKey: "reservation-rail-163-idempotent",
        idempotencyWindowMs: 60_000,
      };

      await dispatchEvent("RESERVATION_DECIDED", payload, options);
      const second = await dispatchEvent("RESERVATION_DECIDED", payload, options);

      expect(second.channels.length).toBe(0);
      expect(deliverSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("stores and pushes nothing when operational in-app delivery is switched off", async () => {
    await withEnv(
      {
        COMMUNICATIONS_EMAIL_ENABLED: "false",
        COMMUNICATIONS_INAPP_ENABLED: "false",
      },
      async () => {
        const userId = new Types.ObjectId();
        const businessId = new Types.ObjectId();
        await createOnDutyManager(businessId, "inapp-off");
        const deliverSpy = vi
          .spyOn(notificationService, "createAndDeliver")
          .mockResolvedValue(fakeDelivered(userId));

        const pending = await dispatchEvent(
          "RESERVATION_PENDING",
          {
            businessId,
            userId,
            reservationId: new Types.ObjectId(),
            reservationStart: new Date("2026-03-23T20:00:00.000Z"),
            guestCount: 2,
          },
          { fireAndForget: true },
        );

        const decided = await dispatchEvent(
          "RESERVATION_DECIDED",
          {
            businessId,
            userId,
            reservationId: new Types.ObjectId(),
            reservationStart: new Date("2026-03-23T20:00:00.000Z"),
            guestCount: 2,
            status: "Confirmed" as const,
          },
          { fireAndForget: true },
        );

        // Both reservation events store nothing and push nothing.
        expect(pending.channels.length).toBe(0);
        expect(decided.channels.length).toBe(0);
        expect(deliverSpy).not.toHaveBeenCalled();
      },
    );
  });

  it("leaves the reservation in place when the in-app delivery fails", async () => {
    await withEnv({ COMMUNICATIONS_EMAIL_ENABLED: "false" }, async () => {
      const customer = await createTestUser("reservation-inapp-fail");
      const businessId = new Types.ObjectId();
      const reservationStart = new Date("2026-03-23T20:00:00.000Z");
      const reservation = await Reservation.create({
        businessId,
        createdByUserId: customer._id,
        createdByRole: "customer",
        guestCount: 3,
        reservationStart,
        reservationEnd: new Date(reservationStart.getTime() + 120 * 60 * 1000),
        status: "Pending",
      });

      vi.spyOn(notificationService, "createAndDeliver").mockRejectedValue(
        new Error("forced in-app delivery failure"),
      );

      // Fire-and-forget: a failed in-app delivery does not undo the booking.
      await expect(
        sendReservationPendingFlow({
          userId: customer._id,
          businessId,
          reservationId: reservation._id as Types.ObjectId,
          reservationStart,
          guestCount: 3,
        }),
      ).resolves.toBeUndefined();

      const storedReservation = await Reservation.findById(
        reservation._id,
      ).lean();
      expect(storedReservation).not.toBeNull();
      expect(storedReservation?.status).toBe("Pending");
    });
  });
});

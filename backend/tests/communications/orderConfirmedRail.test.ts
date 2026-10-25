/**
 * Deliver order confirmed on the rail without undoing the order (issue #162).
 *
 * Caller-regression seam: the one delivery operation
 * `notificationService.createAndDeliver` (the same rail a hand-created
 * notification uses) is mocked, and the email channel is spied. The tests
 * assert that the ORDER_CONFIRMED caller uses that delivery operation once, for
 * the ordering customer only, with the message and severity the caller already
 * supplies; that the email copy keeps using the email rail; that a repeat
 * dispatch inside the idempotency window delivers only once; that operational
 * in-app off stores and pushes nothing; and that a failed in-app delivery
 * leaves the order in place.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import User from "../../src/models/user.ts";
import Order from "../../src/models/order.ts";
import dispatchEvent from "../../src/communications/dispatchEvent.ts";
import notificationService from "../../src/communications/services/notificationService.ts";
import emailChannel from "../../src/communications/channels/emailChannel.ts";
import buildOrderReceiptTemplate from "../../src/communications/templates/orderReceiptTemplate.ts";
import sendOrderConfirmation from "../../src/orderConfirmation/sendOrderConfirmation.ts";

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

describe("Order confirmed on the rail (#162)", () => {
  it("delivers once, to the ordering customer only, with the caller's text and Info severity", async () => {
    await withEnv({ COMMUNICATIONS_EMAIL_ENABLED: "false" }, async () => {
      const userId = new Types.ObjectId();
      const businessId = new Types.ObjectId();
      const deliverSpy = vi
        .spyOn(notificationService, "createAndDeliver")
        .mockResolvedValue(fakeDelivered(userId));

      const payload = {
        businessId,
        userId,
        dailyReferenceNumber: "R-700",
        totalNetPaidAmount: 24.5,
        orderCount: 2,
      };
      const result = await dispatchEvent("ORDER_CONFIRMED", payload, {
        fireAndForget: true,
      });

      expect(result.success).toBe(true);
      expect(deliverSpy).toHaveBeenCalledTimes(1);

      const input = deliverSpy.mock.calls[0][0];
      // Ordering customer only: no employee recipients join this delivery.
      expect(input.recipients.customerUserIds?.map(String)).toEqual([
        String(userId),
      ]);
      expect(input.recipients.employeeIds ?? []).toEqual([]);
      expect(input.recipients.employeeUserIds ?? []).toEqual([]);
      // The stored text and Info severity are the ones the caller supplies.
      expect(input.message).toBe(buildOrderReceiptTemplate(payload));
      expect(input.notificationType).toBe("Info");
      expect(String(input.businessId)).toBe(String(businessId));
    });
  });

  it("keeps the email copy on the email rail, unchanged by this delivery", async () => {
    await withEnv({ COMMUNICATIONS_EMAIL_ENABLED: "true" }, async () => {
      const customer = await createTestUser("order-email-rail");
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
        dailyReferenceNumber: "R-701",
        totalNetPaidAmount: 12.5,
        orderCount: 1,
        orderCode: "CODE-701",
      };
      await dispatchEvent("ORDER_CONFIRMED", payload, { fireAndForget: true });

      // The email copy still rides the email rail with the receipt text.
      expect(emailSpy).toHaveBeenCalledTimes(1);
      const emailInput = emailSpy.mock.calls[0][0];
      expect(emailInput.to).toBe(customer.personalDetails.email);
      expect(emailInput.subject).toBe("Order confirmation - Ref CODE-701");
      expect(emailInput.text).toBe(buildOrderReceiptTemplate(payload));
      // The in-app rail still delivers exactly once alongside the email.
      expect(deliverSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("delivers only one notification for a repeat dispatch inside the idempotency window", async () => {
    await withEnv({ COMMUNICATIONS_EMAIL_ENABLED: "false" }, async () => {
      const userId = new Types.ObjectId();
      const businessId = new Types.ObjectId();
      const deliverSpy = vi
        .spyOn(notificationService, "createAndDeliver")
        .mockResolvedValue(fakeDelivered(userId));

      const payload = {
        businessId,
        userId,
        dailyReferenceNumber: "R-702",
        totalNetPaidAmount: 9,
        orderCount: 1,
      };
      const options = {
        fireAndForget: true as const,
        idempotencyKey: "order-rail-162-idempotent",
        idempotencyWindowMs: 60_000,
      };

      await dispatchEvent("ORDER_CONFIRMED", payload, options);
      const second = await dispatchEvent("ORDER_CONFIRMED", payload, options);

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
        const deliverSpy = vi
          .spyOn(notificationService, "createAndDeliver")
          .mockResolvedValue(fakeDelivered(userId));

        const result = await dispatchEvent(
          "ORDER_CONFIRMED",
          {
            businessId,
            userId,
            dailyReferenceNumber: "R-703",
            totalNetPaidAmount: 13.2,
            orderCount: 1,
          },
          { fireAndForget: true },
        );

        expect(result.channels.length).toBe(0);
        expect(deliverSpy).not.toHaveBeenCalled();
      },
    );
  });

  it("leaves the order in place when the in-app delivery fails", async () => {
    await withEnv({ COMMUNICATIONS_EMAIL_ENABLED: "false" }, async () => {
      const customer = await createTestUser("order-inapp-fail");
      const businessId = new Types.ObjectId();
      const order = await Order.create({
        dailyReferenceNumber: 7,
        orderGrossPrice: 20,
        orderNetPrice: 20,
        orderCostPrice: 6,
        salesInstanceId: new Types.ObjectId(),
        businessGoodId: new Types.ObjectId(),
        businessId,
        createdByUserId: customer._id,
      });

      vi.spyOn(notificationService, "createAndDeliver").mockRejectedValue(
        new Error("forced in-app delivery failure"),
      );

      // Fire-and-forget: a failed in-app delivery does not undo the sale.
      await expect(
        sendOrderConfirmation(customer._id, businessId, {
          dailyReferenceNumber: "R-704",
          totalNetPaidAmount: 20,
          orderCount: 1,
        }),
      ).resolves.toBeUndefined();

      const storedOrder = await Order.findById(order._id).lean();
      expect(storedOrder?.orderNetPrice).toBe(20);
      expect(storedOrder?.billingStatus).toBe("Open");
    });
  });
});

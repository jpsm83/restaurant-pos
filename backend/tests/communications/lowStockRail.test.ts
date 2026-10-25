/**
 * Deliver the low-stock alert on the rail without undoing the stock check
 * (issue #164).
 *
 * Caller-regression seam: the one delivery operation
 * `notificationService.createAndDeliver` (the same rail a hand-created
 * notification uses) is mocked, and the email channel is spied. The tests
 * assert that LOW_STOCK_ALERT uses that delivery operation once, for the
 * managers already resolved for that event, with the stored text and Warning
 * severity the caller already supplies; that this delivery sends no email; that
 * the low-stock cooldown and dispatch idempotency still deliver only once for a
 * suppressed repeat; that operational in-app off stores and pushes nothing; and
 * that a failed in-app delivery leaves the stock check in place.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import Employee from "../../src/models/employee.ts";
import Supplier from "../../src/models/supplier.ts";
import SupplierGood from "../../src/models/supplierGood.ts";
import Inventory from "../../src/models/inventory.ts";
import dispatchEvent from "../../src/communications/dispatchEvent.ts";
import notificationService from "../../src/communications/services/notificationService.ts";
import emailChannel from "../../src/communications/channels/emailChannel.ts";
import buildLowStockTemplate from "../../src/communications/templates/lowStockTemplate.ts";
import checkLowStockAndNotify from "../../src/inventories/checkLowStockAndNotify.ts";

const validAddress = {
  country: "USA",
  state: "CA",
  city: "Los Angeles",
  street: "Main St",
  buildingNumber: "123",
  postCode: "90001",
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

/** A low-stock inventory for a single supplier good, below its par level. */
const createLowStockInventory = async (
  businessId: Types.ObjectId,
  suffix: string,
) => {
  const supplier = await Supplier.create({
    businessId,
    tradeName: `Low Stock Supplier ${suffix}`,
    legalName: `Low Stock Supplier ${suffix} LLC`,
    taxNumber: `SUP-${suffix}-${Date.now()}`,
    email: `supplier-${suffix}@test.com`,
    phoneNumber: "123456789",
    address: validAddress,
  });

  const supplierGood = await SupplierGood.create({
    businessId,
    supplierId: supplier._id,
    name: "Flour",
    keyword: "flour",
    mainCategory: "Food",
    measurementUnit: "kg",
    parLevel: 10,
    minimumQuantityRequired: 8,
    pricePerMeasurementUnit: 4,
  });

  return Inventory.create({
    businessId,
    setFinalCount: false,
    inventoryGoods: [
      {
        supplierGoodId: supplierGood._id,
        dynamicSystemCount: 2,
        monthlyCounts: [],
      },
    ],
  });
};

/** A resolved delivery result so the in-app channel's success path runs. */
const fakeDelivered = (userId: Types.ObjectId) => ({
  notificationId: new Types.ObjectId(),
  recipientUserIds: [userId],
  recipientCount: 1,
  emittedLiveEvent: true,
});

const lowStockPayload = (businessId: Types.ObjectId) => ({
  businessId,
  lowStockItems: [
    {
      supplierGoodId: new Types.ObjectId(),
      name: "Flour",
      currentCount: 2,
      threshold: 10,
    },
  ],
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

describe("Low-stock alert on the rail (#164)", () => {
  it("delivers once, to the managers already resolved, with the caller's text and Warning severity", async () => {
    await withEnv({ COMMUNICATIONS_EMAIL_ENABLED: "false" }, async () => {
      const businessId = new Types.ObjectId();
      const manager = await createOnDutyManager(businessId, "warn");
      const deliverSpy = vi
        .spyOn(notificationService, "createAndDeliver")
        .mockResolvedValue(fakeDelivered(new Types.ObjectId()));

      const payload = lowStockPayload(businessId);
      const result = await dispatchEvent("LOW_STOCK_ALERT", payload, {
        fireAndForget: true,
      });

      expect(result.success).toBe(true);
      // One delivery to the managers already resolved for that event.
      expect(deliverSpy).toHaveBeenCalledTimes(1);

      const input = deliverSpy.mock.calls[0][0];
      expect(input.recipients.employeeIds?.map(String)).toEqual([
        String(manager._id),
      ]);
      // Managers only: no customer joins this delivery.
      expect(input.recipients.customerUserIds ?? []).toEqual([]);
      expect(input.recipients.employeeUserIds ?? []).toEqual([]);
      // The stored text and Warning severity are the ones the caller supplies.
      expect(input.message).toBe(
        buildLowStockTemplate(
          payload.lowStockItems.map((item) => ({
            name: item.name,
            currentCount: item.currentCount,
            threshold: item.threshold,
          })),
        ),
      );
      expect(input.notificationType).toBe("Warning");
      expect(String(input.businessId)).toBe(String(businessId));
    });
  });

  it("sends no email for the low-stock alert, even with the email channel on", async () => {
    await withEnv({ COMMUNICATIONS_EMAIL_ENABLED: "true" }, async () => {
      const businessId = new Types.ObjectId();
      await createOnDutyManager(businessId, "no-email");
      const deliverSpy = vi
        .spyOn(notificationService, "createAndDeliver")
        .mockResolvedValue(fakeDelivered(new Types.ObjectId()));
      const emailSpy = vi.spyOn(emailChannel, "send").mockResolvedValue({
        channel: "email",
        success: true,
        sentCount: 1,
      });

      await dispatchEvent("LOW_STOCK_ALERT", lowStockPayload(businessId), {
        fireAndForget: true,
      });

      // In-app only: the low-stock alert rides the rail and never emails.
      expect(deliverSpy).toHaveBeenCalledTimes(1);
      expect(emailSpy).not.toHaveBeenCalled();
    });
  });

  it("delivers only one notification for a repeat dispatch inside the idempotency window", async () => {
    await withEnv({ COMMUNICATIONS_EMAIL_ENABLED: "false" }, async () => {
      const businessId = new Types.ObjectId();
      await createOnDutyManager(businessId, "idem");
      const deliverSpy = vi
        .spyOn(notificationService, "createAndDeliver")
        .mockResolvedValue(fakeDelivered(new Types.ObjectId()));

      const payload = lowStockPayload(businessId);
      const options = {
        fireAndForget: true as const,
        idempotencyKey: "low-stock-rail-164-idempotent",
        idempotencyWindowMs: 60_000,
      };

      await dispatchEvent("LOW_STOCK_ALERT", payload, options);
      const second = await dispatchEvent("LOW_STOCK_ALERT", payload, options);

      expect(second.channels.length).toBe(0);
      expect(deliverSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("delivers only one notification for a repeated stock check of the same low-stock items", async () => {
    await withEnv({ COMMUNICATIONS_EMAIL_ENABLED: "false" }, async () => {
      const businessId = new Types.ObjectId();
      await createOnDutyManager(businessId, "cooldown");
      await createLowStockInventory(businessId, "cooldown");
      const deliverSpy = vi
        .spyOn(notificationService, "createAndDeliver")
        .mockResolvedValue(fakeDelivered(new Types.ObjectId()));

      // The current low-stock cooldown and dispatch idempotency stay as they
      // are: a repeated check for the same business and items is suppressed
      // (the cooldown gates before dispatch) and delivers no second
      // notification.
      await checkLowStockAndNotify(businessId);
      await checkLowStockAndNotify(businessId);

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
        const businessId = new Types.ObjectId();
        await createOnDutyManager(businessId, "inapp-off");
        const deliverSpy = vi
          .spyOn(notificationService, "createAndDeliver")
          .mockResolvedValue(fakeDelivered(new Types.ObjectId()));

        const result = await dispatchEvent(
          "LOW_STOCK_ALERT",
          lowStockPayload(businessId),
          { fireAndForget: true },
        );

        // Operational in-app off: nothing stored and nothing pushed.
        expect(result.channels.length).toBe(0);
        expect(deliverSpy).not.toHaveBeenCalled();
      },
    );
  });

  it("leaves the stock check in place when the in-app delivery fails", async () => {
    await withEnv({ COMMUNICATIONS_EMAIL_ENABLED: "false" }, async () => {
      const businessId = new Types.ObjectId();
      await createOnDutyManager(businessId, "inapp-fail");
      await createLowStockInventory(businessId, "inapp-fail");

      const deliverSpy = vi
        .spyOn(notificationService, "createAndDeliver")
        .mockRejectedValue(new Error("forced in-app delivery failure"));

      // The delivery is attempted and throws, yet the stock check still
      // completes: the thrown failure is swallowed rather than propagated or
      // rolled back.
      await expect(checkLowStockAndNotify(businessId)).resolves.toBeUndefined();
      expect(deliverSpy).toHaveBeenCalledTimes(1);
    });
  });
});

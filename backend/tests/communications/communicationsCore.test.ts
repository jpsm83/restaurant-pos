import { describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import User from "../../src/models/user.ts";
import Employee from "../../src/models/employee.ts";
import Notification from "../../src/models/notification.ts";
import dispatchEvent from "../../src/communications/dispatchEvent.ts";
import resolveEmployeeUserRecipients from "../../src/communications/recipientResolvers/resolveEmployeeUserRecipients.ts";
import notificationRepository from "../../src/communications/repositories/notificationRepository.ts";
import notificationService from "../../src/communications/services/notificationService.ts";
import { buildApp } from "../../src/server.ts";
import * as liveInAppEvents from "../../src/communications/channels/liveInAppEvents.ts";
import buildOrderReceiptTemplate from "../../src/communications/templates/orderReceiptTemplate.ts";
import buildReservationTemplate from "../../src/communications/templates/reservationTemplate.ts";
import buildLowStockTemplate from "../../src/communications/templates/lowStockTemplate.ts";
import {
  buildMonthlyReportReadyTemplate,
  buildWeeklyReportReadyTemplate,
} from "../../src/communications/templates/reportReadyTemplate.ts";

const validAddress = {
  country: "USA",
  state: "CA",
  city: "Los Angeles",
  street: "Main St",
  buildingNumber: "123",
  postCode: "90001",
};

const createTestUser = async (prefix: string) => {
  const suffix = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return User.create({
    personalDetails: {
      username: `${suffix}-user`,
      email: `${suffix}@test.com`,
      password: "hashedpassword",
      firstName: "Test",
      lastName: "User",
      phoneNumber: "1234567890",
      birthDate: new Date("1990-01-01"),
      gender: "Man",
      nationality: "USA",
      idType: "National ID",
      idNumber: `ID-${suffix}`,
      address: validAddress,
    },
    allUserRoles: ["Customer"],
  });
};

const createTestEmployee = async (input: {
  businessId: Types.ObjectId;
  userId: Types.ObjectId;
  taxSuffix: string;
}) =>
  Employee.create({
    businessId: input.businessId,
    userId: input.userId,
    taxNumber: `EMP-${input.taxSuffix}-${Date.now()}`,
    joinDate: new Date(),
    vacationDaysPerYear: 20,
    vacationDaysLeft: 20,
    allEmployeeRoles: ["Manager"],
    onDuty: true,
    currentShiftRole: "Manager",
  });

describe("Communications Core - Dispatcher Event Routing", () => {
  it("routes ORDER_CONFIRMED to in-app and persists user inbox entry", async () => {
    const previousEmailToggle = process.env.COMMUNICATIONS_EMAIL_ENABLED;
    process.env.COMMUNICATIONS_EMAIL_ENABLED = "false";

    const user = await createTestUser("order-confirmed-routing");
    const businessId = new Types.ObjectId();
    const result = await dispatchEvent(
      "ORDER_CONFIRMED",
      {
        businessId,
        userId: user._id,
        dailyReferenceNumber: "R-100",
        totalNetPaidAmount: 24.5,
        orderCount: 2,
      },
      { fireAndForget: true }
    );

    expect(result.success).toBe(true);
    expect(result.channels.some((channel) => channel.channel === "inApp")).toBe(true);

    const notificationDocs = await Notification.find({ businessId }).lean();
    const updatedUser = await User.findById(user._id).select("notifications").lean();
    expect(notificationDocs.length).toBe(1);
    expect(updatedUser?.notifications?.length ?? 0).toBe(1);

    if (previousEmailToggle === undefined) {
      delete process.env.COMMUNICATIONS_EMAIL_ENABLED;
    } else {
      process.env.COMMUNICATIONS_EMAIL_ENABLED = previousEmailToggle;
    }
  });

  it("skips duplicate dispatches within idempotency window", async () => {
    const previousEmailToggle = process.env.COMMUNICATIONS_EMAIL_ENABLED;
    process.env.COMMUNICATIONS_EMAIL_ENABLED = "false";

    const user = await createTestUser("order-confirmed-idempotency");
    const businessId = new Types.ObjectId();
    const options = {
      fireAndForget: true as const,
      idempotencyKey: "order-ref-unique-001",
      idempotencyWindowMs: 60_000,
    };

    const first = await dispatchEvent(
      "ORDER_CONFIRMED",
      {
        businessId,
        userId: user._id,
        dailyReferenceNumber: "R-200",
        totalNetPaidAmount: 11,
        orderCount: 1,
      },
      options
    );
    const second = await dispatchEvent(
      "ORDER_CONFIRMED",
      {
        businessId,
        userId: user._id,
        dailyReferenceNumber: "R-200",
        totalNetPaidAmount: 11,
        orderCount: 1,
      },
      options
    );

    expect(first.channels.length).toBeGreaterThan(0);
    expect(second.success).toBe(true);
    expect(second.channels.length).toBe(0);

    if (previousEmailToggle === undefined) {
      delete process.env.COMMUNICATIONS_EMAIL_ENABLED;
    } else {
      process.env.COMMUNICATIONS_EMAIL_ENABLED = previousEmailToggle;
    }
  });

  it("rejects unknown events via handler map guard", async () => {
    await expect(
      dispatchEvent(
        "UNKNOWN_EVENT" as any,
        { businessId: new Types.ObjectId() } as any,
        { fireAndForget: true }
      )
    ).rejects.toThrow("Unsupported event handler");
  });
});

describe("Communications Core - Recipient Resolvers", () => {
  it("resolves employeeIds into employeeUserIds and merges direct user ids", async () => {
    const businessId = new Types.ObjectId();
    const userFromEmployee = await createTestUser("resolver-employee-user");
    const directUser = await createTestUser("resolver-direct-user");
    const employee = await createTestEmployee({
      businessId,
      userId: userFromEmployee._id,
      taxSuffix: "resolver",
    });

    const resolved = await resolveEmployeeUserRecipients({
      employeeIds: [employee._id],
      employeeUserIds: [directUser._id],
    });

    const userIds = resolved.employeeUserIds.map((id) => id.toString());
    expect(resolved.employeeIds.map((id) => id.toString())).toContain(
      employee._id.toString()
    );
    expect(userIds).toContain(userFromEmployee._id.toString());
    expect(userIds).toContain(directUser._id.toString());
  });
});

describe("Communications Core - Template Builders", () => {
  it("builds expected order and report messages", () => {
    const order = buildOrderReceiptTemplate({
      dailyReferenceNumber: "A-1",
      totalNetPaidAmount: 9.5,
      orderCount: 1,
    });
    const weekly = buildWeeklyReportReadyTemplate("2026-W12");
    const monthly = buildMonthlyReportReadyTemplate("2026-03");

    expect(order).toContain("Order confirmed. Ref: A-1.");
    expect(order).toContain("Total paid: 9.50.");
    expect(weekly).toBe("Weekly business report for 2026-W12 is ready.");
    expect(monthly).toBe(
      "Monthly business report for 2026-03 is ready to be reviewed."
    );
  });

  it("builds reservation and low-stock templates", () => {
    const reservation = buildReservationTemplate({
      reservationId: "R-99",
      status: "Pending",
      reservationStart: new Date("2026-03-23T12:00:00.000Z"),
      guestCount: 4,
      description: "Birthday table",
    });
    const lowStock = buildLowStockTemplate([
      { name: "Tomato", currentCount: 2, threshold: 5 },
      { name: "Cheese", currentCount: 1, threshold: 3 },
    ]);

    expect(reservation).toContain("Reservation – Ref R-99");
    expect(reservation).toContain("Status: Pending");
    expect(reservation).toContain("Guests: 4");
    expect(lowStock).toBe("Low stock: Tomato (2/5), Cheese (1/3)");
  });
});

describe("Communications Core - Repository Fanout", () => {
  it("creates notification and fans out to customer + employee-linked users", async () => {
    const businessId = new Types.ObjectId();
    const customerUser = await createTestUser("fanout-customer");
    const employeeUser = await createTestUser("fanout-employee-user");
    const employee = await createTestEmployee({
      businessId,
      userId: employeeUser._id,
      taxSuffix: "fanout",
    });

    const result = await notificationRepository.createAndFanout({
      message: "Fanout test notification",
      businessId,
      recipients: {
        customerUserIds: [customerUser._id],
        employeeIds: [employee._id],
      },
      notificationType: "Info",
    });

    expect(result.recipientCount).toBe(2);

    const createdNotification = await Notification.findById(result.notificationId).lean();
    expect(createdNotification).not.toBeNull();

    const [updatedCustomer, updatedEmployeeUser] = await Promise.all([
      User.findById(customerUser._id).select("notifications").lean(),
      User.findById(employeeUser._id).select("notifications").lean(),
    ]);

    expect(updatedCustomer?.notifications?.length ?? 0).toBe(1);
    expect(updatedEmployeeUser?.notifications?.length ?? 0).toBe(1);
  });
});

describe("Communications Core - Notification Service", () => {
  it("createAndDeliver validates recipients and emits live event", async () => {
    const businessId = new Types.ObjectId();
    const customer = await createTestUser("service-customer");
    const emitSpy = vi.spyOn(liveInAppEvents, "emitLiveInAppNotification");

    const result = await notificationService.createAndDeliver({
      message: "Service delivery test",
      businessId,
      recipients: {
        customerUserIds: [customer._id],
      },
      notificationType: "Info",
      correlationId: "corr-service-1",
    });

    const userAfter = await User.findById(customer._id).select("notifications").lean();
    expect(result.recipientCount).toBe(1);
    expect(result.emittedLiveEvent).toBe(true);
    expect(userAfter?.notifications?.length ?? 0).toBe(1);
    expect(emitSpy).toHaveBeenCalledTimes(1);

    emitSpy.mockRestore();
  });

  it("createAndDeliver throws when no recipients resolve", async () => {
    const businessId = new Types.ObjectId();
    await expect(
      notificationService.createAndDeliver({
        message: "No recipients",
        businessId,
        recipients: {},
      })
    ).rejects.toThrow("No recipients resolved");
  });
});

describe("Communications Core - Feature Flags", () => {
  it("COMMUNICATIONS_INAPP_ENABLED=false skips in-app persistence", async () => {
    const previousInAppToggle = process.env.COMMUNICATIONS_INAPP_ENABLED;
    const previousEmailToggle = process.env.COMMUNICATIONS_EMAIL_ENABLED;
    process.env.COMMUNICATIONS_INAPP_ENABLED = "false";
    process.env.COMMUNICATIONS_EMAIL_ENABLED = "false";

    const user = await createTestUser("inapp-disabled");
    const businessId = new Types.ObjectId();

    const result = await dispatchEvent(
      "ORDER_CONFIRMED",
      {
        businessId,
        userId: user._id,
        dailyReferenceNumber: "NO-INAPP-1",
        totalNetPaidAmount: 13.2,
        orderCount: 1,
      },
      { fireAndForget: true, preferredChannels: ["inApp"] }
    );

    const [userAfter, notificationDocs] = await Promise.all([
      User.findById(user._id).select("notifications").lean(),
      Notification.find({ businessId }).lean(),
    ]);

    expect(result.success).toBe(true);
    expect(result.channels.length).toBe(0);
    expect(notificationDocs.length).toBe(0);
    expect(userAfter?.notifications?.length ?? 0).toBe(0);

    if (previousInAppToggle === undefined) delete process.env.COMMUNICATIONS_INAPP_ENABLED;
    else process.env.COMMUNICATIONS_INAPP_ENABLED = previousInAppToggle;
    if (previousEmailToggle === undefined) delete process.env.COMMUNICATIONS_EMAIL_ENABLED;
    else process.env.COMMUNICATIONS_EMAIL_ENABLED = previousEmailToggle;
  });

  it("COMMUNICATIONS_INAPP_LIVE_ENABLED=false disables /notifications/live websocket route", async () => {
    const previousLiveToggle = process.env.COMMUNICATIONS_INAPP_LIVE_ENABLED;
    process.env.COMMUNICATIONS_INAPP_LIVE_ENABLED = "false";

    const app = await buildApp({ logger: false, skipDb: true });
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address() as AddressInfo;
    const wsUrl = `ws://127.0.0.1:${address.port}/api/v1/notifications/live`;

    try {
      const closedCode = await new Promise<number>((resolve) => {
        const socket = new WebSocket(wsUrl);
        socket.on("unexpected-response", (_request, response) => {
          resolve(response.statusCode ?? 0);
          socket.terminate();
        });
        socket.on("close", (code) => resolve(code));
      });

      // With route disabled, upgrade is rejected by HTTP layer (expected non-101).
      expect(closedCode).not.toBe(101);
    } finally {
      await app.close();
      if (previousLiveToggle === undefined)
        delete process.env.COMMUNICATIONS_INAPP_LIVE_ENABLED;
      else process.env.COMMUNICATIONS_INAPP_LIVE_ENABLED = previousLiveToggle;
    }
  });
});

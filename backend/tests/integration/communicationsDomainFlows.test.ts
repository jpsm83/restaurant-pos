import { afterEach, describe, expect, it } from "vitest";
import { EventEmitter } from "node:events";
import { Types } from "mongoose";
import type { WebSocket } from "ws";
import User from "../../src/models/user.ts";
import Employee from "../../src/models/employee.ts";
import Notification from "../../src/models/notification.ts";
import Supplier from "../../src/models/supplier.ts";
import SupplierGood from "../../src/models/supplierGood.ts";
import Inventory from "../../src/models/inventory.ts";
import sendOrderConfirmation from "../../src/orderConfirmation/sendOrderConfirmation.ts";
import {
  sendReservationDecisionFlow,
  sendReservationPendingFlow,
} from "../../src/reservations/sendReservationCustomerFlow.ts";
import checkLowStockAndNotify from "../../src/inventories/checkLowStockAndNotify.ts";
import sendMonthlyReportReadyNotification from "../../src/monthlyBusinessReport/sendMonthlyReportReadyNotification.ts";
import sendWeeklyReportReadyNotification from "../../src/weeklyBusinessReport/sendWeeklyReportReadyNotification.ts";
import liveConnectionRegistry from "../../src/communications/live/connectionRegistry.ts";
import liveInAppChannel from "../../src/communications/channels/liveInAppChannel.ts";
import dispatchEvent from "../../src/communications/dispatchEvent.ts";
import { getCommunicationsMetricsSnapshot } from "../../src/communications/observability/metrics.ts";
import { getTestApp } from "../setup.ts";

const validAddress = {
  country: "USA",
  state: "CA",
  city: "Los Angeles",
  street: "Main St",
  buildingNumber: "123",
  postCode: "90001",
};

class FakeSocket extends EventEmitter {
  public OPEN = 1;
  public readyState = 1;
  public sentPayloads: string[] = [];

  send(payload: string): void {
    this.sentPayloads.push(payload);
  }

  ping(): void {
    this.emit("pong");
  }

  close(): void {
    this.readyState = 3;
    this.emit("close");
  }

  terminate(): void {
    this.close();
  }
}

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

const createManager = async (params: {
  businessId: Types.ObjectId;
  userId: Types.ObjectId;
  onDuty?: boolean;
  taxSuffix: string;
}) =>
  Employee.create({
    businessId: params.businessId,
    userId: params.userId,
    taxNumber: `MGR-${params.taxSuffix}-${Date.now()}`,
    joinDate: new Date(),
    vacationDaysPerYear: 20,
    vacationDaysLeft: 20,
    allEmployeeRoles: ["Manager"],
    currentShiftRole: "Manager",
    onDuty: params.onDuty ?? true,
    active: true,
  });

afterEach(() => {
  liveConnectionRegistry.clearAllConnections();
  liveConnectionRegistry.stopHeartbeat();
});

describe("Phase 5.2 - Communications Integration Domain Flows", () => {
  it("self-order flow sends order confirmation to user channels", async () => {
    const previousEmailToggle = process.env.COMMUNICATIONS_EMAIL_ENABLED;
    process.env.COMMUNICATIONS_EMAIL_ENABLED = "false";

    const businessId = new Types.ObjectId();
    const customer = await createTestUser("self-order");

    const startedAt = Date.now();
    await sendOrderConfirmation(customer._id, businessId, {
      dailyReferenceNumber: "SELF-100",
      totalNetPaidAmount: 32.5,
      orderCount: 2,
      orderCode: "SELF-100",
    });
    const elapsedMs = Date.now() - startedAt;

    const userAfter = await User.findById(customer._id).select("notifications").lean();
    expect(userAfter?.notifications?.length ?? 0).toBe(1);
    // Runtime latency sanity check for non-blocking order confirmation path.
    expect(elapsedMs).toBeLessThan(1500);

    if (previousEmailToggle === undefined) delete process.env.COMMUNICATIONS_EMAIL_ENABLED;
    else process.env.COMMUNICATIONS_EMAIL_ENABLED = previousEmailToggle;
  });

  it("delivery flow sends order confirmation to user channels", async () => {
    const previousEmailToggle = process.env.COMMUNICATIONS_EMAIL_ENABLED;
    process.env.COMMUNICATIONS_EMAIL_ENABLED = "false";

    const businessId = new Types.ObjectId();
    const customer = await createTestUser("delivery-order");

    await sendOrderConfirmation(customer._id, businessId, {
      dailyReferenceNumber: "DEL-200",
      totalNetPaidAmount: 18.75,
      orderCount: 1,
      orderCode: "DEL-200",
    });

    const userAfter = await User.findById(customer._id).select("notifications").lean();
    expect(userAfter?.notifications?.length ?? 0).toBe(1);

    if (previousEmailToggle === undefined) delete process.env.COMMUNICATIONS_EMAIL_ENABLED;
    else process.env.COMMUNICATIONS_EMAIL_ENABLED = previousEmailToggle;
  });

  it("reservation pending + decision flows notify customer and managers", async () => {
    const previousEmailToggle = process.env.COMMUNICATIONS_EMAIL_ENABLED;
    process.env.COMMUNICATIONS_EMAIL_ENABLED = "false";

    const businessId = new Types.ObjectId();
    const customer = await createTestUser("reservation-customer");
    const managerUser = await createTestUser("reservation-manager");
    const manager = await createManager({
      businessId,
      userId: managerUser._id,
      onDuty: true,
      taxSuffix: "res",
    });

    const reservationId = new Types.ObjectId();
    const reservationStart = new Date("2026-03-23T20:00:00.000Z");

    await sendReservationPendingFlow({
      userId: customer._id,
      businessId,
      reservationId,
      reservationStart,
      guestCount: 3,
      description: "Window seat",
    });

    await sendReservationDecisionFlow({
      userId: customer._id,
      businessId,
      reservationId,
      reservationStart,
      guestCount: 3,
      status: "Confirmed",
    });

    const [customerAfter, managerAfter] = await Promise.all([
      User.findById(customer._id).select("notifications").lean(),
      User.findById(managerUser._id).select("notifications").lean(),
    ]);

    expect(customerAfter?.notifications?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(managerAfter?.notifications?.length ?? 0).toBeGreaterThanOrEqual(1);

    const managerNotifications = await Notification.find({
      businessId,
      employeesRecipientsIds: manager._id,
    }).lean();
    expect(managerNotifications.length).toBeGreaterThan(0);

    if (previousEmailToggle === undefined) delete process.env.COMMUNICATIONS_EMAIL_ENABLED;
    else process.env.COMMUNICATIONS_EMAIL_ENABLED = previousEmailToggle;
  });

  it("low stock trigger creates warning notification", async () => {
    const businessId = new Types.ObjectId();
    const managerUser = await createTestUser("low-stock-manager");
    await createManager({
      businessId,
      userId: managerUser._id,
      onDuty: true,
      taxSuffix: "low",
    });

    const supplier = await Supplier.create({
      businessId,
      tradeName: "Low Stock Supplier",
      legalName: "Low Stock Supplier LLC",
      taxNumber: `SUP-${Date.now()}`,
      email: "supplier-low@test.com",
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

    await Inventory.create({
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

    await checkLowStockAndNotify(businessId);
    await checkLowStockAndNotify(businessId);

    const notifications = await Notification.find({
      businessId,
      notificationType: "Warning",
    }).lean();
    expect(notifications.length).toBe(1);
    expect(notifications[0].message).toContain("Low stock");
  });

  it("monthly and weekly report-ready flows emit notifications", async () => {
    const businessId = new Types.ObjectId();
    const managerUser = await createTestUser("reports-manager");
    await createManager({
      businessId,
      userId: managerUser._id,
      onDuty: false,
      taxSuffix: "reports",
    });

    await sendMonthlyReportReadyNotification(businessId, "2026-03");
    await sendWeeklyReportReadyNotification(businessId, "2026-W12");

    const [monthly, weekly] = await Promise.all([
      Notification.findOne({
        businessId,
        message: /Monthly business report/,
      }).lean(),
      Notification.findOne({
        businessId,
        message: /Weekly business report/,
      }).lean(),
    ]);

    expect(monthly).not.toBeNull();
    expect(weekly).not.toBeNull();
  });

  it("WebSocket live push sends payload for connected recipients", async () => {
    const userId = new Types.ObjectId();
    const socket = new FakeSocket();
    liveConnectionRegistry.registerSocket(userId, socket as unknown as WebSocket);

    const startedAt = Date.now();
    const result = await liveInAppChannel.send({
      notificationId: new Types.ObjectId(),
      businessId: new Types.ObjectId(),
      message: "Live push test",
      notificationType: "Info",
      recipientUserIds: [userId],
      eventName: "ORDER_CONFIRMED",
      correlationId: "corr-live-connected",
    });
    const elapsedMs = Date.now() - startedAt;

    expect(result.success).toBe(true);
    expect((result.sentCount ?? 0) > 0).toBe(true);
    expect(socket.sentPayloads.length).toBeGreaterThan(0);
    const livePayload = JSON.parse(socket.sentPayloads[0]);
    expect(livePayload.type).toBe("notification.created");
    expect(typeof livePayload.data.notificationId).toBe("string");
    expect(typeof livePayload.data.businessId).toBe("string");
    expect(livePayload.data.message).toBe("Live push test");
    expect(livePayload.data.notificationType).toBe("Info");
    expect(livePayload.data.correlationId).toBe("corr-live-connected");
    expect(livePayload.data.eventName).toBeUndefined();
    expect(elapsedMs).toBeLessThan(1000);
  });

  it("falls back to persisted delivery when no active WebSocket exists", async () => {
    const app = await getTestApp();
    const customer = await createTestUser("fallback-inbox");
    const businessId = new Types.ObjectId();

    await dispatchEvent(
      "ORDER_CONFIRMED",
      {
        businessId,
        userId: customer._id,
        dailyReferenceNumber: "FALLBACK-1",
        totalNetPaidAmount: 10.5,
        orderCount: 1,
      },
      {
        fireAndForget: true,
        preferredChannels: ["inApp", "liveInApp"],
      }
    );

    const beforeMetrics = getCommunicationsMetricsSnapshot();
    const result = await liveInAppChannel.send({
      notificationId: new Types.ObjectId(),
      businessId: new Types.ObjectId(),
      message: "Live fallback test",
      notificationType: "Info",
      recipientUserIds: [new Types.ObjectId()],
      eventName: "LOW_STOCK_ALERT",
      correlationId: "corr-live-fallback",
    });

    expect(result.success).toBe(true);
    expect(result.sentCount).toBe(0);
    expect(result.error).toContain("No active WebSocket connections");
    const afterMetrics = getCommunicationsMetricsSnapshot();
    expect(
      (afterMetrics.live.droppedPushesByReason.offline_recipient ?? 0) -
        (beforeMetrics.live.droppedPushesByReason.offline_recipient ?? 0)
    ).toBeGreaterThanOrEqual(1);

    const userInboxResponse = await app.inject({
      method: "GET",
      url: `/api/v1/notifications/user/${customer._id.toString()}`,
    });
    expect(userInboxResponse.statusCode).toBe(200);
    const body = JSON.parse(userInboxResponse.body) as Array<{ message?: string }>;
    expect(body.length).toBeGreaterThan(0);
    expect(body.some((notification) => notification.message?.includes("Order confirmed."))).toBe(
      true
    );
  });

  it("tracks socket_send_failure drop reason when websocket send throws", async () => {
    const userId = new Types.ObjectId();
    const socket = new FakeSocket();
    socket.send = () => {
      throw new Error("forced send failure");
    };
    liveConnectionRegistry.registerSocket(userId, socket as unknown as WebSocket);

    const beforeMetrics = getCommunicationsMetricsSnapshot();
    const result = await liveInAppChannel.send({
      notificationId: new Types.ObjectId(),
      businessId: new Types.ObjectId(),
      message: "Live send failure test",
      notificationType: "Info",
      recipientUserIds: [userId],
      correlationId: "corr-send-failure",
    });
    const afterMetrics = getCommunicationsMetricsSnapshot();

    expect(result.success).toBe(true);
    expect(result.sentCount).toBe(0);
    expect(
      (afterMetrics.live.droppedPushesByReason.socket_send_failure ?? 0) -
        (beforeMetrics.live.droppedPushesByReason.socket_send_failure ?? 0)
    ).toBeGreaterThanOrEqual(1);
  });
});

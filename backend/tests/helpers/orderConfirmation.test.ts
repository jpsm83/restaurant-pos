import { describe, it, expect, vi } from "vitest";
import { Types } from "mongoose";
import User from "../../src/models/user.ts";
import Notification from "../../src/models/notification.ts";
import buildOrderReceiptTemplate from "../../src/communications/templates/orderReceiptTemplate.ts";

const dispatchEventMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/communications/dispatchEvent.ts", () => ({
  default: dispatchEventMock,
}));

import sendOrderConfirmation from "../../src/orderConfirmation/sendOrderConfirmation.ts";

describe("Order Confirmation Communication", () => {
  it("keeps receipt message format parity", () => {
    const message = buildOrderReceiptTemplate({
      dailyReferenceNumber: "12345",
      totalNetPaidAmount: 19.5,
      orderCount: 2,
    });

    expect(message).toContain("Order confirmed.");
    expect(message).toContain("Ref: 12345");
    expect(message).toContain("Items: 2");
    expect(message).toContain("Total paid: 19.50");
    expect(message).toContain("Keep this receipt for your records.");
  });

  it("sendOrderConfirmation stays non-blocking on dispatch failure", async () => {
    dispatchEventMock.mockRejectedValueOnce(new Error("forced dispatch failure"));

    await expect(
      sendOrderConfirmation(new Types.ObjectId(), new Types.ObjectId(), {
        dailyReferenceNumber: "A-1",
        totalNetPaidAmount: 9.99,
        orderCount: 1,
      })
    ).resolves.toBeUndefined();
  });

  it("dispatchEvent ORDER_CONFIRMED persists in-app inbox notification", async () => {
    const { default: realDispatchEvent } = await vi.importActual<
      typeof import("../../src/communications/dispatchEvent.ts")
    >("../../src/communications/dispatchEvent.ts");

    const previousEmailToggle = process.env.COMMUNICATIONS_EMAIL_ENABLED;
    process.env.COMMUNICATIONS_EMAIL_ENABLED = "false";

    const user = await User.create({
      personalDetails: {
        email: "order-confirmation@test.com",
        password: "hashedpassword",
        firstName: "Order",
        lastName: "Customer",
        phoneNumber: "1234567890",
        birthDate: new Date("1990-01-01"),
        gender: "Man",
        nationality: "Portugal",
        address: {
          country: "Portugal",
          state: "Lisbon",
          city: "Lisbon",
          street: "Main Street",
          buildingNumber: "10",
          postCode: "1000-100",
        },
        idNumber: "ORDER-ID-001",
        idType: "Passport",
        username: "order_customer",
      },
      allUserRoles: ["Customer"],
    });

    const businessId = new Types.ObjectId();
    const result = await realDispatchEvent(
      "ORDER_CONFIRMED",
      {
        businessId,
        userId: user._id,
        dailyReferenceNumber: "R-123",
        totalNetPaidAmount: 12.34,
        orderCount: 1,
      },
      { fireAndForget: true }
    );

    const notificationDocs = await Notification.find({ businessId }).lean();
    const updatedUser = await User.findById(user._id)
      .select("notifications")
      .lean();

    expect(result.success).toBe(true);
    expect(notificationDocs.length).toBe(1);
    expect(notificationDocs[0].message).toContain("Order confirmed.");
    expect(updatedUser?.notifications?.length ?? 0).toBe(1);

    if (previousEmailToggle === undefined) {
      delete process.env.COMMUNICATIONS_EMAIL_ENABLED;
    } else {
      process.env.COMMUNICATIONS_EMAIL_ENABLED = previousEmailToggle;
    }
  });
});


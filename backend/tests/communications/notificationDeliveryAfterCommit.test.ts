/**
 * Notification delivery rail - "deliver only after the store commits" (issue #160).
 *
 * Seam under test: `notificationService.createAndDeliver`, the one delivery
 * operation, with the live socket list faked. Assertions cover the stored
 * notification, the per-recipient inbox entries, and how many times a socket
 * was pushed. They do not assert the live connection server, the heartbeat, or
 * metrics.
 *
 * The live bridge (subscribed by `buildApp`) turns the persisted-notification
 * event into a push to the faked sockets registered in the connection registry.
 */
import { afterEach, describe, expect, it } from "vitest";
import { EventEmitter } from "node:events";
import mongoose, { Types } from "mongoose";
import type { ClientSession } from "mongoose";
import type { WebSocket } from "ws";
import User from "../../src/models/user.ts";
import Employee from "../../src/models/employee.ts";
import Notification from "../../src/models/notification.ts";
import notificationService from "../../src/communications/services/notificationService.ts";
import liveConnectionRegistry from "../../src/communications/live/connectionRegistry.ts";
import { isTransientMongoClusterError } from "../../src/mongo/transientClusterError.ts";
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

const registerFakeSocket = (userId: Types.ObjectId): FakeSocket => {
  const socket = new FakeSocket();
  liveConnectionRegistry.registerSocket(userId, socket as unknown as WebSocket);
  return socket;
};

/**
 * Runs transactional delivery work, retrying only on transient MongoDB cluster
 * errors (e.g. the in-memory replica set's "catalog changes"). This mirrors the
 * production route's `runTxnWithTransientRetry`, which wraps the same service.
 */
const withRetriedTransaction = async (
  run: (session: ClientSession) => Promise<void>,
): Promise<void> => {
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await run(session);
      return;
    } catch (err) {
      await session.abortTransaction().catch(() => undefined);
      last = err;
      if (isTransientMongoClusterError(err) && attempt < 3) continue;
      throw err;
    } finally {
      session.endSession();
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
};

afterEach(() => {
  liveConnectionRegistry.clearAllConnections();
  liveConnectionRegistry.stopHeartbeat();
});

describe("Notification delivery after commit (#160)", () => {
  it("does not push before commit and pushes once after a committed transaction", async () => {
    await getTestApp(); // subscribes the live bridge
    const businessId = new Types.ObjectId();
    const customer = await createTestUser("txn-commit");
    const socket = registerFakeSocket(customer._id);

    await withRetriedTransaction(async (session) => {
      await notificationService.createAndDeliver({
        message: "Committed delivery",
        businessId,
        recipients: { customerUserIds: [customer._id] },
        notificationType: "Info",
        session,
      });

      // The store is still open in its transaction: nothing is pushed yet.
      expect(socket.sentPayloads.length).toBe(0);

      await session.commitTransaction();
    });

    expect(socket.sentPayloads.length).toBe(1);
    const stored = await Notification.find({ businessId }).lean();
    expect(stored.length).toBe(1);
    const userAfter = await User.findById(customer._id)
      .select("notifications")
      .lean();
    expect(userAfter?.notifications?.length ?? 0).toBe(1);
  });

  it("leaves no push and no committed inbox entry when the transaction aborts", async () => {
    await getTestApp();
    const businessId = new Types.ObjectId();
    const customer = await createTestUser("txn-abort");
    const socket = registerFakeSocket(customer._id);

    // A deliberate abort is the terminal outcome here, so it is not retried;
    // only a transient failure while opening/writing the transaction retries.
    await withRetriedTransaction(async (session) => {
      await notificationService.createAndDeliver({
        message: "Aborted delivery",
        businessId,
        recipients: { customerUserIds: [customer._id] },
        notificationType: "Info",
        session,
      });
      await session.abortTransaction();
    });

    expect(socket.sentPayloads.length).toBe(0);
    const stored = await Notification.find({ businessId }).lean();
    expect(stored.length).toBe(0);
    const userAfter = await User.findById(customer._id)
      .select("notifications")
      .lean();
    expect(userAfter?.notifications?.length ?? 0).toBe(0);
  });

  it("stores once and pushes once to an online recipient without a transaction", async () => {
    await getTestApp();
    const businessId = new Types.ObjectId();
    const customer = await createTestUser("online-once");
    const socket = registerFakeSocket(customer._id);

    await notificationService.createAndDeliver({
      message: "Online delivery",
      businessId,
      recipients: { customerUserIds: [customer._id] },
      notificationType: "Info",
    });

    expect(socket.sentPayloads.length).toBe(1);
    const stored = await Notification.find({ businessId }).lean();
    expect(stored.length).toBe(1);
    const userAfter = await User.findById(customer._id)
      .select("notifications")
      .lean();
    expect(userAfter?.notifications?.length ?? 0).toBe(1);
  });

  it("pushes once to each open connection of the same recipient", async () => {
    await getTestApp();
    const businessId = new Types.ObjectId();
    const customer = await createTestUser("two-connections");
    const socketA = registerFakeSocket(customer._id);
    const socketB = registerFakeSocket(customer._id);

    await notificationService.createAndDeliver({
      message: "Two-connection delivery",
      businessId,
      recipients: { customerUserIds: [customer._id] },
      notificationType: "Info",
    });

    expect(socketA.sentPayloads.length).toBe(1);
    expect(socketB.sentPayloads.length).toBe(1);
  });

  it("stores an offline recipient without pushing", async () => {
    await getTestApp();
    const businessId = new Types.ObjectId();
    const customer = await createTestUser("offline");
    // No socket registered: the recipient is offline.

    await notificationService.createAndDeliver({
      message: "Offline delivery",
      businessId,
      recipients: { customerUserIds: [customer._id] },
      notificationType: "Info",
    });

    const stored = await Notification.find({ businessId }).lean();
    expect(stored.length).toBe(1);
    const userAfter = await User.findById(customer._id)
      .select("notifications")
      .lean();
    expect(userAfter?.notifications?.length ?? 0).toBe(1);
  });

  it("keeps stored entries and the other recipient's push when one recipient's push fails", async () => {
    await getTestApp();
    const businessId = new Types.ObjectId();
    const failingCustomer = await createTestUser("push-fail");
    const okCustomer = await createTestUser("push-ok");

    const failingSocket = new FakeSocket();
    failingSocket.send = () => {
      throw new Error("forced send failure");
    };
    liveConnectionRegistry.registerSocket(
      failingCustomer._id,
      failingSocket as unknown as WebSocket,
    );
    const okSocket = registerFakeSocket(okCustomer._id);

    await expect(
      notificationService.createAndDeliver({
        message: "Partial push failure",
        businessId,
        recipients: {
          customerUserIds: [failingCustomer._id, okCustomer._id],
        },
        notificationType: "Info",
      }),
    ).resolves.toBeDefined();

    // The store survives a push failure and the other recipient is still pushed.
    const stored = await Notification.find({ businessId }).lean();
    expect(stored.length).toBe(1);
    expect(okSocket.sentPayloads.length).toBe(1);
    const [failingAfter, okAfter] = await Promise.all([
      User.findById(failingCustomer._id).select("notifications").lean(),
      User.findById(okCustomer._id).select("notifications").lean(),
    ]);
    expect(failingAfter?.notifications?.length ?? 0).toBe(1);
    expect(okAfter?.notifications?.length ?? 0).toBe(1);
  });

  it("stores nothing and pushes nothing for an empty message, a missing business, or no recipient", async () => {
    await getTestApp();
    const businessId = new Types.ObjectId();
    const customer = await createTestUser("nothing-stored");
    const socket = registerFakeSocket(customer._id);

    await expect(
      notificationService.createAndDeliver({
        message: "   ",
        businessId,
        recipients: { customerUserIds: [customer._id] },
      }),
    ).rejects.toThrow(/message is required/i);

    await expect(
      notificationService.createAndDeliver({
        message: "Missing business",
        businessId: undefined as unknown as Types.ObjectId,
        recipients: { customerUserIds: [customer._id] },
      }),
    ).rejects.toThrow(/business id is required/i);

    await expect(
      notificationService.createAndDeliver({
        message: "No recipient",
        businessId,
        recipients: {},
      }),
    ).rejects.toThrow(/no recipients resolved/i);

    expect(socket.sentPayloads.length).toBe(0);
    const stored = await Notification.find({ businessId }).lean();
    expect(stored.length).toBe(0);
    const userAfter = await User.findById(customer._id)
      .select("notifications")
      .lean();
    expect(userAfter?.notifications?.length ?? 0).toBe(0);
  });

  it("produces one notification and one unread inbox entry per recipient, with duplicates and an employee collapsed to one entry each", async () => {
    await getTestApp();
    const businessId = new Types.ObjectId();
    const customerOne = await createTestUser("many-c1");
    const customerTwo = await createTestUser("many-c2");
    const employeeUser = await createTestUser("many-emp-user");
    const employee = await createTestEmployee({
      businessId,
      userId: employeeUser._id,
      taxSuffix: "many",
    });

    const result = await notificationService.createAndDeliver({
      message: "Shared delivery",
      businessId,
      recipients: {
        // customerOne appears twice: duplicates collapse to one entry each.
        customerUserIds: [customerOne._id, customerOne._id, customerTwo._id],
        employeeIds: [employee._id],
      },
      notificationType: "Info",
    });

    const stored = await Notification.find({ businessId }).lean();
    expect(stored.length).toBe(1);
    expect(result.recipientCount).toBe(3);

    const [afterOne, afterTwo, afterEmployeeUser] = await Promise.all([
      User.findById(customerOne._id).select("notifications").lean(),
      User.findById(customerTwo._id).select("notifications").lean(),
      User.findById(employeeUser._id).select("notifications").lean(),
    ]);

    for (const after of [afterOne, afterTwo, afterEmployeeUser]) {
      expect(after?.notifications?.length ?? 0).toBe(1);
      expect(after?.notifications?.[0].readFlag).toBe(false);
      expect(after?.notifications?.[0].deletedFlag).toBe(false);
    }
  });

  it("stores the caller's text and severity, defaulting a missing severity to Info", async () => {
    await getTestApp();
    const businessId = new Types.ObjectId();
    const customer = await createTestUser("severity");

    await notificationService.createAndDeliver({
      message: "Warning text",
      businessId,
      recipients: { customerUserIds: [customer._id] },
      notificationType: "Warning",
    });
    await notificationService.createAndDeliver({
      message: "Default severity text",
      businessId,
      recipients: { customerUserIds: [customer._id] },
    });

    const warning = await Notification.findOne({
      businessId,
      message: "Warning text",
    }).lean();
    const defaulted = await Notification.findOne({
      businessId,
      message: "Default severity text",
    }).lean();

    expect(warning?.notificationType).toBe("Warning");
    expect(defaulted?.notificationType).toBe("Info");
  });

  it("stores but does not push when live push is switched off", async () => {
    await getTestApp();
    const previousLiveToggle = process.env.COMMUNICATIONS_INAPP_LIVE_ENABLED;
    process.env.COMMUNICATIONS_INAPP_LIVE_ENABLED = "false";

    const businessId = new Types.ObjectId();
    const customer = await createTestUser("live-off");
    const socket = registerFakeSocket(customer._id);

    try {
      await notificationService.createAndDeliver({
        message: "Live push off delivery",
        businessId,
        recipients: { customerUserIds: [customer._id] },
        notificationType: "Info",
      });

      expect(socket.sentPayloads.length).toBe(0);
      const stored = await Notification.find({ businessId }).lean();
      expect(stored.length).toBe(1);
      const userAfter = await User.findById(customer._id)
        .select("notifications")
        .lean();
      expect(userAfter?.notifications?.length ?? 0).toBe(1);
    } finally {
      if (previousLiveToggle === undefined)
        delete process.env.COMMUNICATIONS_INAPP_LIVE_ENABLED;
      else process.env.COMMUNICATIONS_INAPP_LIVE_ENABLED = previousLiveToggle;
    }
  });

  it("still stores and pushes a hand-created delivery when operational in-app delivery is switched off", async () => {
    await getTestApp();
    const previousInAppToggle = process.env.COMMUNICATIONS_INAPP_ENABLED;
    process.env.COMMUNICATIONS_INAPP_ENABLED = "false";

    const businessId = new Types.ObjectId();
    const customer = await createTestUser("inapp-off-direct");
    const socket = registerFakeSocket(customer._id);

    try {
      await notificationService.createAndDeliver({
        message: "Hand-created delivery with operational in-app off",
        businessId,
        recipients: { customerUserIds: [customer._id] },
        notificationType: "Info",
      });

      expect(socket.sentPayloads.length).toBe(1);
      const stored = await Notification.find({ businessId }).lean();
      expect(stored.length).toBe(1);
      const userAfter = await User.findById(customer._id)
        .select("notifications")
        .lean();
      expect(userAfter?.notifications?.length ?? 0).toBe(1);
    } finally {
      if (previousInAppToggle === undefined)
        delete process.env.COMMUNICATIONS_INAPP_ENABLED;
      else process.env.COMMUNICATIONS_INAPP_ENABLED = previousInAppToggle;
    }
  });
});

import { describe, expect, it } from "vitest";
import WebSocket from "ws";
import type { AddressInfo } from "node:net";
import { buildApp } from "../../src/server.ts";
import Business from "../../src/models/business.ts";
import User from "../../src/models/user.ts";
import { getCommunicationsMetricsSnapshot } from "../../src/communications/observability/metrics.ts";

const withLiveServer = async <T>(
  callback: (input: { baseUrl: string; app: Awaited<ReturnType<typeof buildApp>> }) => Promise<T>
): Promise<T> => {
  const app = await buildApp({ logger: false, skipDb: true });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address() as AddressInfo;
  const baseUrl = `ws://127.0.0.1:${address.port}/api/v1/notifications/live`;

  try {
    return await callback({ baseUrl, app });
  } finally {
    await app.close();
  }
};

describe("Notifications Live Route", () => {
  const validAddress = {
    country: "USA",
    state: "CA",
    city: "Los Angeles",
    street: "Main St",
    buildingNumber: "123",
    postCode: "90001",
  };

  const createTestBusiness = async () => {
    return await Business.create({
      tradeName: "WS Test Restaurant",
      legalName: "WS Test Restaurant LLC",
      email: `ws-test-${Date.now()}@restaurant.com`,
      password: "hashedpassword",
      phoneNumber: "1234567890",
      taxNumber: `WS-TAX-${Date.now()}`,
      currencyTrade: "USD",
      subscription: "Free",
      address: validAddress,
    });
  };

  const createTestUser = async (prefix: string) => {
    return await User.create({
      personalDetails: {
        username: `${prefix}-user`,
        email: `${prefix}-${Date.now()}@test.com`,
        password: "hashedpassword",
        firstName: "Test",
        lastName: "User",
        phoneNumber: "1234567890",
        birthDate: new Date("1990-01-01"),
        gender: "Man",
        nationality: "USA",
        idType: "National ID",
        idNumber: `ID-${prefix}-${Date.now()}`,
        address: validAddress,
      },
    });
  };

  it("rejects websocket connection without bearer token", async () => {
    await withLiveServer(async ({ baseUrl }) => {
      const beforeMetrics = getCommunicationsMetricsSnapshot();
      const closed = await new Promise<{ code: number; reason: string }>((resolve) => {
        const socket = new WebSocket(baseUrl);
        socket.on("close", (code, reason) =>
          resolve({ code, reason: reason.toString() })
        );
      });

      expect(closed.code).toBe(1008);
      expect(closed.reason).toBe("Unauthorized");
      const afterMetrics = getCommunicationsMetricsSnapshot();
      expect(
        (afterMetrics.live.authFailuresByReason.missing_bearer_token ?? 0) -
          (beforeMetrics.live.authFailuresByReason.missing_bearer_token ?? 0)
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("rejects websocket connection with invalid bearer token", async () => {
    await withLiveServer(async ({ baseUrl }) => {
      const closed = await new Promise<{ code: number; reason: string }>((resolve) => {
        const socket = new WebSocket(baseUrl, {
          headers: { Authorization: "Bearer invalid-token" },
        });
        socket.on("close", (code, reason) =>
          resolve({ code, reason: reason.toString() })
        );
      });

      expect(closed.code).toBe(1008);
      expect(closed.reason).toBe("Unauthorized");
    });
  });

  it("rejects websocket connection for non-user session token", async () => {
    await withLiveServer(async ({ baseUrl, app }) => {
      const businessToken = app.jwt.sign({
        id: "business-id",
        email: "owner@test.com",
        type: "business",
      });

      const closed = await new Promise<{ code: number; reason: string }>((resolve) => {
        const socket = new WebSocket(baseUrl, {
          headers: { Authorization: `Bearer ${businessToken}` },
        });
        socket.on("close", (code, reason) =>
          resolve({ code, reason: reason.toString() })
        );
      });

      expect(closed.code).toBe(1008);
      expect(closed.reason).toBe("Forbidden");
    });
  });

  it("accepts user token and returns connection ack payload contract", async () => {
    await withLiveServer(async ({ baseUrl, app }) => {
      const userId = "65f0c2b6a2e42e8d4f8d1111";
      const userToken = app.jwt.sign({
        id: userId,
        email: "customer@test.com",
        type: "user",
      });

      const message = await new Promise<string>((resolve, reject) => {
        const socket = new WebSocket(baseUrl, {
          headers: { Authorization: `Bearer ${userToken}` },
        });

        socket.on("message", (data) => {
          const payload = data.toString();
          socket.close();
          resolve(payload);
        });

        socket.on("error", reject);
      });

      const parsed = JSON.parse(message);
      expect(parsed.type).toBe("notification.live.connected");
      expect(parsed.data).toEqual({ userId });
    });
  });

  it("accepts token via access_token query parameter", async () => {
    await withLiveServer(async ({ baseUrl, app }) => {
      const userId = "65f0c2b6a2e42e8d4f8d2222";
      const userToken = app.jwt.sign({
        id: userId,
        email: "customer-query@test.com",
        type: "user",
      });

      const message = await new Promise<string>((resolve, reject) => {
        const socket = new WebSocket(`${baseUrl}?access_token=${encodeURIComponent(userToken)}`);
        socket.on("message", (data) => {
          const payload = data.toString();
          socket.close();
          resolve(payload);
        });
        socket.on("error", reject);
      });

      const parsed = JSON.parse(message);
      expect(parsed.type).toBe("notification.live.connected");
      expect(parsed.data).toEqual({ userId });
    });
  });

  it("POST /notifications emits notification.created for connected recipient", async () => {
    await withLiveServer(async ({ baseUrl, app }) => {
      const business = await createTestBusiness();
      const user = await createTestUser("live-post");
      const userToken = app.jwt.sign({
        id: user._id.toString(),
        email: user.personalDetails.email,
        type: "user",
      });

      const pushedPayload = await new Promise<string>((resolve, reject) => {
        const socket = new WebSocket(baseUrl, {
          headers: { Authorization: `Bearer ${userToken}` },
        });

        socket.on("message", async (raw) => {
          const message = raw.toString();
          const parsed = JSON.parse(message);
          if (parsed.type === "notification.live.connected") {
            const response = await app.inject({
              method: "POST",
              url: "/api/v1/notifications",
              payload: {
                notificationType: "Info",
                message: "Live push from manual POST route",
                businessId: business._id.toString(),
                customersRecipientsIds: [user._id.toString()],
              },
            });
            if (response.statusCode !== 201) {
              reject(new Error(`Unexpected status code: ${response.statusCode}`));
              socket.close();
              return;
            }
            return;
          }

          if (parsed.type === "notification.created") {
            socket.close();
            resolve(message);
          }
        });

        socket.on("error", reject);
      });

      const parsed = JSON.parse(pushedPayload);
      expect(parsed.type).toBe("notification.created");
      expect(parsed.data.message).toBe("Live push from manual POST route");
      expect(parsed.data.businessId).toBe(business._id.toString());
      expect(typeof parsed.data.notificationId).toBe("string");
      expect(parsed.data.notificationType).toBe("Info");
      expect(typeof parsed.data.correlationId).toBe("string");
      expect(parsed.data.correlationId.length).toBeGreaterThan(0);
      expect(parsed.data.eventName).toBeUndefined();
    });
  });

  it("two-user live flow sends only to target and preserves offline inbox fallback", async () => {
    await withLiveServer(async ({ baseUrl, app }) => {
      const business = await createTestBusiness();
      const targetUser = await createTestUser("live-target");
      const nonTargetUser = await createTestUser("live-non-target");
      const offlineUser = await createTestUser("live-offline");

      const targetToken = app.jwt.sign({
        id: targetUser._id.toString(),
        email: targetUser.personalDetails.email,
        type: "user",
      });
      const nonTargetToken = app.jwt.sign({
        id: nonTargetUser._id.toString(),
        email: nonTargetUser.personalDetails.email,
        type: "user",
      });

      const targetSocket = new WebSocket(baseUrl, {
        headers: { Authorization: `Bearer ${targetToken}` },
      });
      const nonTargetSocket = new WebSocket(baseUrl, {
        headers: { Authorization: `Bearer ${nonTargetToken}` },
      });

      const targetMessages: Array<{ type?: string; data?: { message?: string } }> = [];
      const nonTargetMessages: Array<{ type?: string; data?: { message?: string } }> = [];

      const waitForAck = (socket: WebSocket): Promise<void> =>
        new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("Timed out waiting for connection ACK")),
            5_000
          );
          socket.on("message", (raw) => {
            const parsed = JSON.parse(raw.toString());
            if (parsed.type === "notification.live.connected") {
              clearTimeout(timeout);
              resolve();
            }
          });
          socket.on("error", (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });

      targetSocket.on("message", (raw) => {
        targetMessages.push(JSON.parse(raw.toString()));
      });
      nonTargetSocket.on("message", (raw) => {
        nonTargetMessages.push(JSON.parse(raw.toString()));
      });

      try {
        await Promise.all([waitForAck(targetSocket), waitForAck(nonTargetSocket)]);

        const targetMessageText = "Target-only live notification";
        const offlineMessageText = "Offline fallback notification";

        const targetCreateResponse = await app.inject({
          method: "POST",
          url: "/api/v1/notifications",
          payload: {
            notificationType: "Info",
            message: targetMessageText,
            businessId: business._id.toString(),
            customersRecipientsIds: [targetUser._id.toString()],
          },
        });
        expect(targetCreateResponse.statusCode).toBe(201);

        await new Promise((resolve) => setTimeout(resolve, 250));

        expect(
          targetMessages.some(
            (message) =>
              message.type === "notification.created" &&
              message.data?.message === targetMessageText
          )
        ).toBe(true);
        expect(
          nonTargetMessages.some(
            (message) =>
              message.type === "notification.created" &&
              message.data?.message === targetMessageText
          )
        ).toBe(false);

        const offlineCreateResponse = await app.inject({
          method: "POST",
          url: "/api/v1/notifications",
          payload: {
            notificationType: "Info",
            message: offlineMessageText,
            businessId: business._id.toString(),
            customersRecipientsIds: [offlineUser._id.toString()],
          },
        });
        expect(offlineCreateResponse.statusCode).toBe(201);

        const offlineInboxResponse = await app.inject({
          method: "GET",
          url: `/api/v1/notifications/user/${offlineUser._id.toString()}`,
        });
        expect(offlineInboxResponse.statusCode).toBe(200);
        const offlineInbox = JSON.parse(offlineInboxResponse.body) as Array<{
          message?: string;
        }>;
        expect(
          offlineInbox.some((notification) => notification.message === offlineMessageText)
        ).toBe(true);
      } finally {
        targetSocket.close();
        nonTargetSocket.close();
      }
    });
  });
});


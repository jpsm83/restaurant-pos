import { beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import type { AddressInfo } from "node:net";
import { Types } from "mongoose";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/server.ts";
import Business from "../../src/models/business.ts";
import RefreshSession from "../../src/models/refreshSession.ts";
import User from "../../src/models/user.ts";
import { getCommunicationsMetricsSnapshot } from "../../src/communications/observability/metrics.ts";
import { resetLiveTicketStoreForTests } from "../../src/auth/liveTicketStore.ts";
import { signAccessTokenForLiveSession } from "../setup.ts";

function liveUserToken(
  app: FastifyInstance,
  id: string,
  email: string,
): Promise<string> {
  return signAccessTokenForLiveSession(app, {
    id,
    email,
    type: "user",
    role: "Customer",
  });
}

async function issueLiveTicket(
  app: FastifyInstance,
  accessToken: string,
): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/live-ticket",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.statusCode !== 201) {
    throw new Error(`Ticket endpoint returned ${response.statusCode}: ${response.body}`);
  }

  return (JSON.parse(response.body) as { ticket: string }).ticket;
}

const socketUrl = (baseUrl: string, ticket: string): string =>
  `${baseUrl}?ticket=${encodeURIComponent(ticket)}`;

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
  beforeEach(() => {
    resetLiveTicketStoreForTests();
  });

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

  it("rejects websocket connection without a ticket", async () => {
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
        (afterMetrics.live.authFailuresByReason.missing_ticket ?? 0) -
          (beforeMetrics.live.authFailuresByReason.missing_ticket ?? 0)
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("refuses to issue a ticket for a revoked access session", async () => {
    await withLiveServer(async ({ app }) => {
      const user = await createTestUser("live-revoked");
      const userToken = await liveUserToken(
        app,
        user._id.toString(),
        String(user.personalDetails.email),
      );
      await RefreshSession.updateMany(
        { accountId: user._id },
        { $set: { revoked: true } },
      );

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/live-ticket",
        headers: { Authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  it("refuses to issue a ticket for a session-less access token", async () => {
    await withLiveServer(async ({ app }) => {
      const userToken = app.jwt.sign({
        id: new Types.ObjectId().toString(),
        email: "session-less@test.com",
        type: "user",
        role: "Customer",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/live-ticket",
        headers: { Authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  it("closes a websocket connection with an invalid ticket", async () => {
    await withLiveServer(async ({ baseUrl }) => {
      const beforeMetrics = getCommunicationsMetricsSnapshot();
      const closed = await new Promise<{ code: number; reason: string }>((resolve) => {
        const socket = new WebSocket(socketUrl(baseUrl, "not-a-real-ticket"));
        socket.on("close", (code, reason) =>
          resolve({ code, reason: reason.toString() })
        );
      });

      expect(closed.code).toBe(1008);
      expect(closed.reason).toBe("Unauthorized");
      const afterMetrics = getCommunicationsMetricsSnapshot();
      expect(
        (afterMetrics.live.authFailuresByReason.invalid_ticket ?? 0) -
          (beforeMetrics.live.authFailuresByReason.invalid_ticket ?? 0)
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("accepts a user ticket and returns the connection ack payload contract", async () => {
    await withLiveServer(async ({ baseUrl, app }) => {
      const user = await createTestUser("live-ack");
      const userToken = await liveUserToken(
        app,
        user._id.toString(),
        String(user.personalDetails.email),
      );
      const ticket = await issueLiveTicket(app, userToken);

      const message = await new Promise<string>((resolve, reject) => {
        const socket = new WebSocket(socketUrl(baseUrl, ticket));

        socket.on("message", (data) => {
          const payload = data.toString();
          socket.close();
          resolve(payload);
        });

        socket.on("error", reject);
      });

      const parsed = JSON.parse(message);
      expect(parsed.type).toBe("live.connected");
      expect(parsed.data).toEqual({ accountId: user._id.toString() });
    });
  });

  it("rejects a ticket after the account generation changes", async () => {
    await withLiveServer(async ({ baseUrl, app }) => {
      const user = await createTestUser("live-generation");
      const userToken = await liveUserToken(
        app,
        user._id.toString(),
        String(user.personalDetails.email),
      );
      const ticket = await issueLiveTicket(app, userToken);

      await User.updateOne(
        { _id: user._id },
        { $inc: { refreshSessionVersion: 1 } },
      );

      const closed = await new Promise<{ code: number; reason: string }>(
        (resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("socket stayed open")),
            3_000,
          );
          const socket = new WebSocket(socketUrl(baseUrl, ticket));
          socket.on("close", (code, reason) => {
            clearTimeout(timer);
            resolve({ code, reason: reason.toString() });
          });
          socket.on("message", () => {
            clearTimeout(timer);
            socket.close();
            reject(new Error("generation-mismatched ticket was accepted"));
          });
          socket.on("error", (error) => {
            clearTimeout(timer);
            reject(error);
          });
        },
      );

      expect(closed.code).toBe(1008);
      expect(closed.reason).toBe("Unauthorized");
    });
  });

  it("rejects a ticket issued before the account was soft-deleted", async () => {
    await withLiveServer(async ({ baseUrl, app }) => {
      const user = await createTestUser("live-deleted");
      const userToken = await liveUserToken(
        app,
        user._id.toString(),
        String(user.personalDetails.email),
      );
      const ticket = await issueLiveTicket(app, userToken);

      await User.updateOne(
        { _id: user._id },
        { $set: { deleted: true, deletedAt: new Date(), deletedBy: user._id } },
      );

      const closed = await new Promise<{ code: number; reason: string }>(
        (resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("socket stayed open")),
            3_000,
          );
          const socket = new WebSocket(socketUrl(baseUrl, ticket));
          socket.on("close", (code, reason) => {
            clearTimeout(timer);
            resolve({ code, reason: reason.toString() });
          });
          socket.on("message", () => {
            clearTimeout(timer);
            socket.close();
            reject(new Error("soft-deleted account ticket was accepted"));
          });
          socket.on("error", (error) => {
            clearTimeout(timer);
            reject(error);
          });
        },
      );

      expect(closed.code).toBe(1008);
      expect(closed.reason).toBe("Unauthorized");
    });
  });

  it("accepts a one-time ticket and rejects a reused ticket", async () => {
    await withLiveServer(async ({ baseUrl, app }) => {
      const user = await createTestUser("live-ticket-reuse");
      const userToken = await liveUserToken(
        app,
        user._id.toString(),
        String(user.personalDetails.email),
      );
      const ticket = await issueLiveTicket(app, userToken);

      await new Promise<void>((resolve, reject) => {
        const socket = new WebSocket(socketUrl(baseUrl, ticket));
        socket.on("message", () => {
          socket.close();
          resolve();
        });
        socket.on("error", reject);
      });

      const closed = await new Promise<{ code: number; reason: string }>((resolve) => {
        const socket = new WebSocket(socketUrl(baseUrl, ticket));
        socket.on("close", (code, reason) =>
          resolve({ code, reason: reason.toString() })
        );
      });

      expect(closed.code).toBe(1008);
      expect(closed.reason).toBe("Unauthorized");
    });
  });

  it("POST /notifications emits notification.created for connected recipient", async () => {
    await withLiveServer(async ({ baseUrl, app }) => {
      const business = await createTestBusiness();
      const user = await createTestUser("live-post");
      const userToken = await liveUserToken(
        app,
        user._id.toString(),
        String(user.personalDetails.email),
      );
      const ticket = await issueLiveTicket(app, userToken);

      const pushedPayload = await new Promise<string>((resolve, reject) => {
        const socket = new WebSocket(socketUrl(baseUrl, ticket));

        socket.on("message", async (raw) => {
          const message = raw.toString();
          const parsed = JSON.parse(message);
          if (parsed.type === "live.connected") {
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

      const targetToken = await liveUserToken(
        app,
        targetUser._id.toString(),
        String(targetUser.personalDetails.email),
      );
      const nonTargetToken = await liveUserToken(
        app,
        nonTargetUser._id.toString(),
        String(nonTargetUser.personalDetails.email),
      );

      const targetSocket = new WebSocket(
        socketUrl(baseUrl, await issueLiveTicket(app, targetToken)),
      );
      const nonTargetSocket = new WebSocket(
        socketUrl(baseUrl, await issueLiveTicket(app, nonTargetToken)),
      );

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
            if (parsed.type === "live.connected") {
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

  it("two open connections of the same user each receive live.connected and notification.created once", async () => {
    await withLiveServer(async ({ baseUrl, app }) => {
      const business = await createTestBusiness();
      const user = await createTestUser("live-two-tabs");
      const token = await liveUserToken(
        app,
        user._id.toString(),
        String(user.personalDetails.email),
      );

      const waitForAck = (socket: WebSocket): Promise<void> =>
        new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("Timed out waiting for live.connected")),
            5_000,
          );
          socket.on("message", (raw) => {
            const parsed = JSON.parse(raw.toString());
            if (parsed.type === "live.connected") {
              clearTimeout(timeout);
              resolve();
            }
          });
          socket.on("error", (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });

      const first = new WebSocket(
        socketUrl(baseUrl, await issueLiveTicket(app, token)),
      );
      const second = new WebSocket(
        socketUrl(baseUrl, await issueLiveTicket(app, token)),
      );

      const firstCreated: string[] = [];
      const secondCreated: string[] = [];
      first.on("message", (raw) => {
        const parsed = JSON.parse(raw.toString());
        if (parsed.type === "notification.created") {
          firstCreated.push(parsed.data?.message ?? "");
        }
      });
      second.on("message", (raw) => {
        const parsed = JSON.parse(raw.toString());
        if (parsed.type === "notification.created") {
          secondCreated.push(parsed.data?.message ?? "");
        }
      });

      try {
        await Promise.all([waitForAck(first), waitForAck(second)]);

        const response = await app.inject({
          method: "POST",
          url: "/api/v1/notifications",
          payload: {
            notificationType: "Info",
            message: "Pushed to both tabs",
            businessId: business._id.toString(),
            customersRecipientsIds: [user._id.toString()],
          },
        });
        expect(response.statusCode).toBe(201);

        await new Promise((resolve) => setTimeout(resolve, 250));

        expect(firstCreated).toEqual(["Pushed to both tabs"]);
        expect(secondCreated).toEqual(["Pushed to both tabs"]);
      } finally {
        first.close();
        second.close();
      }
    });
  });
});

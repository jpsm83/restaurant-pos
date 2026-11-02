/**
 * Self-only notification inbox route tests.
 *
 * The inbox is derived from the authenticated User session and never from a
 * client-supplied id. These tests exercise the HTTP seam: authentication,
 * visibility filtering, unread count, ordering, and pagination bounds.
 */

import { describe, expect, it } from "vitest";
import { Types } from "mongoose";

import Notification from "../../src/models/notification.ts";
import RefreshSession from "../../src/models/refreshSession.ts";
import User from "../../src/models/user.ts";
import { generateTestToken, getTestApp } from "../setup.ts";
import { detail, isProblemDetails } from "../helpers/problemDetails.ts";

const createTestUser = async (prefix: string) => {
  const unique = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return User.create({
    personalDetails: {
      email: `${unique}@test.com`,
      password: "hashedpassword",
    },
  });
};

const tokenFor = async (user: {
  _id: Types.ObjectId;
  personalDetails: { email: string };
}) =>
  generateTestToken({
    id: user._id.toString(),
    email: user.personalDetails.email,
    type: "user",
    role: "Customer",
  });

const seedNotifications = async (
  entries: Array<{
    _id: Types.ObjectId;
    businessId: Types.ObjectId;
    message: string;
    createdAt: Date;
    deleted?: boolean;
  }>,
) =>
  Notification.insertMany(
    entries.map((entry) => ({
      ...entry,
      notificationType: "Info",
      updatedAt: entry.createdAt,
    })),
    { ordered: true },
  );

describe("Notifications Inbox Route", () => {
  describe("GET /api/v1/notifications/inbox", () => {
    it("refuses an unauthenticated request", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/notifications/inbox",
      });

      expect(response.statusCode).toBe(401);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("Authentication required");
    });

    it("refuses a non-User session", async () => {
      const app = await getTestApp();
      const user = await createTestUser("inbox-business-token");
      const stored = await RefreshSession.create({
        accountId: user._id,
        accountType: "user",
        refreshSessionVersion: 0,
        mode: "customer",
        expiresAt: new Date(Date.now() + 60_000),
      });
      const token = app.jwt.sign({
        id: user._id.toString(),
        email: user.personalDetails.email,
        type: "business",
        role: "Tenant",
        sessionId: stored._id.toString(),
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/notifications/inbox",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(401);
      expect(isProblemDetails(response)).toBe(true);
    });

    it("returns only the caller's entries across businesses with read state and unread count", async () => {
      const app = await getTestApp();
      const caller = await createTestUser("inbox-caller");
      const other = await createTestUser("inbox-other");
      const businessA = new Types.ObjectId();
      const businessB = new Types.ObjectId();
      const businessC = new Types.ObjectId();
      const createdAt = new Date("2026-01-01T12:00:00.000Z");

      const [unread, read, otherEntry] = await seedNotifications([
        {
          _id: new Types.ObjectId("000000000000000000000001"),
          businessId: businessA,
          message: "Caller unread",
          createdAt,
        },
        {
          _id: new Types.ObjectId("000000000000000000000002"),
          businessId: businessB,
          message: "Caller read",
          createdAt: new Date(createdAt.getTime() + 1_000),
        },
        {
          _id: new Types.ObjectId("000000000000000000000003"),
          businessId: businessC,
          message: "Other person's entry",
          createdAt: new Date(createdAt.getTime() + 2_000),
        },
      ]);

      await User.updateOne(
        { _id: caller._id },
        {
          $set: {
            notifications: [
              {
                notificationId: unread._id,
                readFlag: false,
                deletedFlag: false,
              },
              {
                notificationId: read._id,
                readFlag: true,
                deletedFlag: false,
              },
            ],
          },
        },
      );
      await User.updateOne(
        { _id: other._id },
        {
          $set: {
            notifications: [
              {
                notificationId: otherEntry._id,
                readFlag: false,
                deletedFlag: false,
              },
            ],
          },
        },
      );

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/notifications/inbox",
        headers: { authorization: await tokenFor(caller) },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.page).toBe(1);
      expect(body.limit).toBe(20);
      expect(body.hasMore).toBe(false);
      expect(body.unreadCount).toBe(1);
      expect(body.items).toEqual([
        {
          notificationId: read._id.toString(),
          businessId: businessB.toString(),
          notificationType: "Info",
          message: "Caller read",
          createdAt: new Date(createdAt.getTime() + 1_000).toISOString(),
          read: true,
        },
        {
          notificationId: unread._id.toString(),
          businessId: businessA.toString(),
          notificationType: "Info",
          message: "Caller unread",
          createdAt: createdAt.toISOString(),
          read: false,
        },
      ]);
    });

    it("omits per-person hidden entries and soft-deleted notifications from the list and unread count", async () => {
      const app = await getTestApp();
      const caller = await createTestUser("inbox-visibility");
      const businessId = new Types.ObjectId();
      const createdAt = new Date("2026-02-01T12:00:00.000Z");

      const [visible, hidden, softDeleted] = await seedNotifications([
        {
          _id: new Types.ObjectId("000000000000000000000011"),
          businessId,
          message: "Visible unread",
          createdAt,
        },
        {
          _id: new Types.ObjectId("000000000000000000000012"),
          businessId,
          message: "Hidden unread",
          createdAt: new Date(createdAt.getTime() + 1_000),
        },
        {
          _id: new Types.ObjectId("000000000000000000000013"),
          businessId,
          message: "Soft-deleted unread",
          createdAt: new Date(createdAt.getTime() + 2_000),
          deleted: true,
        },
      ]);

      await User.updateOne(
        { _id: caller._id },
        {
          $set: {
            notifications: [
              {
                notificationId: visible._id,
                readFlag: false,
                deletedFlag: false,
              },
              {
                notificationId: hidden._id,
                readFlag: false,
                deletedFlag: true,
              },
              {
                notificationId: softDeleted._id,
                readFlag: false,
                deletedFlag: false,
              },
            ],
          },
        },
      );

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/notifications/inbox",
        headers: { authorization: await tokenFor(caller) },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.unreadCount).toBe(1);
      expect(body.items.map((item: { notificationId: string }) => item.notificationId)).toEqual([
        visible._id.toString(),
      ]);
    });

    it("orders newest first and breaks equal creation times by notification id descending", async () => {
      const app = await getTestApp();
      const caller = await createTestUser("inbox-order");
      const businessId = new Types.ObjectId();
      const base = new Date("2026-03-01T12:00:00.000Z");

      const [first, second, newest, oldest] = await seedNotifications([
        {
          _id: new Types.ObjectId("000000000000000000000021"),
          businessId,
          message: "First equal-time",
          createdAt: base,
        },
        {
          _id: new Types.ObjectId("000000000000000000000022"),
          businessId,
          message: "Second equal-time",
          createdAt: base,
        },
        {
          _id: new Types.ObjectId("000000000000000000000023"),
          businessId,
          message: "Newest",
          createdAt: new Date(base.getTime() + 1_000),
        },
        {
          _id: new Types.ObjectId("000000000000000000000024"),
          businessId,
          message: "Oldest",
          createdAt: new Date(base.getTime() - 1_000),
        },
      ]);

      await User.updateOne(
        { _id: caller._id },
        {
          $set: {
            notifications: [first, second, newest, oldest].map((notification) => ({
              notificationId: notification._id,
              readFlag: false,
              deletedFlag: false,
            })),
          },
        },
      );

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/notifications/inbox",
        headers: { authorization: await tokenFor(caller) },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.items.map((item: { message: string }) => item.message)).toEqual([
        "Newest",
        "Second equal-time",
        "First equal-time",
        "Oldest",
      ]);
    });

    it("paginates with hasMore and clamps page/limit to the documented bounds", async () => {
      const app = await getTestApp();
      const caller = await createTestUser("inbox-pagination");
      const businessId = new Types.ObjectId();
      const base = new Date("2026-04-01T12:00:00.000Z");

      const notifications = await seedNotifications(
        Array.from({ length: 5 }, (_, index) => ({
          _id: new Types.ObjectId(
            `00000000000000000000003${index + 1}`,
          ),
          businessId,
          message: `Message ${index + 1}`,
          createdAt: new Date(base.getTime() + index * 1_000),
        })),
      );

      await User.updateOne(
        { _id: caller._id },
        {
          $set: {
            notifications: notifications.map((notification) => ({
              notificationId: notification._id,
              readFlag: false,
              deletedFlag: false,
            })),
          },
        },
      );

      const headers = { authorization: await tokenFor(caller) };
      const firstPage = await app.inject({
        method: "GET",
        url: "/api/v1/notifications/inbox?page=1&limit=2",
        headers,
      });
      expect(firstPage.statusCode).toBe(200);
      expect(firstPage.json()).toMatchObject({
        page: 1,
        limit: 2,
        hasMore: true,
        unreadCount: 5,
      });
      expect(firstPage.json().items).toHaveLength(2);

      const lastPage = await app.inject({
        method: "GET",
        url: "/api/v1/notifications/inbox?page=3&limit=2",
        headers,
      });
      expect(lastPage.statusCode).toBe(200);
      expect(lastPage.json()).toMatchObject({
        page: 3,
        limit: 2,
        hasMore: false,
      });
      expect(lastPage.json().items).toHaveLength(1);

      const clamped = await app.inject({
        method: "GET",
        url: "/api/v1/notifications/inbox?page=0&limit=500",
        headers,
      });
      expect(clamped.statusCode).toBe(200);
      expect(clamped.json()).toMatchObject({
        page: 1,
        limit: 100,
        hasMore: false,
      });

      const defaulted = await app.inject({
        method: "GET",
        url: "/api/v1/notifications/inbox?page=1&limit=0",
        headers,
      });
      expect(defaulted.statusCode).toBe(200);
      expect(defaulted.json()).toMatchObject({
        page: 1,
        limit: 20,
        hasMore: false,
      });
    });

    it("returns an empty page for a caller with no inbox entries", async () => {
      const app = await getTestApp();
      const caller = await createTestUser("inbox-empty");

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/notifications/inbox",
        headers: { authorization: await tokenFor(caller) },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        items: [],
        unreadCount: 0,
        page: 1,
        limit: 20,
        hasMore: false,
      });
    });
  });

  describe("removed user-id inbox listing route", () => {
    it("returns 404", async () => {
      const app = await getTestApp();
      const caller = await createTestUser("inbox-removed-route");

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/notifications/user/${caller._id.toString()}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });
});

/**
 * Notification inbox reads and per-person state.
 *
 * The recipient is always the authenticated caller id passed by the route; no
 * request input selects a person. Entries are joined to their notification
 * records, per-person hidden entries and soft-deleted records are dropped, and
 * the result is ordered by notification creation time with a deterministic
 * notification-id tie-breaker. Read and hide actions touch only the caller's
 * entry flags on the User row; the Notification record is never changed.
 */
import { Types } from "mongoose";
import type {
  INotificationInboxHideResponse,
  INotificationInboxReadResponse,
  INotificationInboxResponse,
  INotificationInboxUnreadCountResponse,
} from "restaurant-pos-packages/interfaces/INotification";

import Notification from "../../models/notification.ts";
import User from "../../models/user.ts";
import { withSoftDeleteFilter } from "../../models/softDelete.ts";
import { notFound } from "../../errors/appError.ts";

const INBOX_NOT_FOUND_DETAIL = "Notification not found in inbox";

interface ListInboxInput {
  userId: string;
  page: number;
  limit: number;
}

interface EntryActionInput {
  userId: string;
  notificationId: string;
}

interface InboxEntry {
  notificationId?: Types.ObjectId;
  readFlag?: boolean;
  deletedFlag?: boolean;
}

interface NotificationRecord {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  notificationType: string;
  message: string;
  createdAt: Date;
}

const loadVisibleEntries = async (userId: string): Promise<InboxEntry[]> => {
  const user = (await User.findById(userId)
    .select("notifications")
    .lean()) as { notifications?: InboxEntry[] } | null;

  return (user?.notifications ?? []).filter(
    (entry) => entry.notificationId && entry.deletedFlag !== true,
  );
};

const updateCallerEntry = async (
  userId: string,
  notificationId: string,
  set: Record<string, boolean>,
): Promise<void> => {
  const result = await User.updateOne(
    {
      _id: new Types.ObjectId(userId),
      "notifications.notificationId": new Types.ObjectId(notificationId),
    },
    { $set: set },
  );

  if (result.matchedCount === 0) {
    throw notFound(INBOX_NOT_FOUND_DETAIL);
  }
};

/**
 * List one person's visible inbox page. The unread count covers every visible
 * entry, not only the current page.
 */
export const listInbox = async ({
  userId,
  page,
  limit,
}: ListInboxInput): Promise<INotificationInboxResponse> => {
  const visibleEntries = await loadVisibleEntries(userId);

  if (visibleEntries.length === 0) {
    return { items: [], unreadCount: 0, page, limit, hasMore: false };
  }

  const notifications = (await Notification.find(
    withSoftDeleteFilter({
      _id: { $in: visibleEntries.map((entry) => entry.notificationId) },
    }),
  )
    .select("_id businessId notificationType message createdAt")
    .lean()) as NotificationRecord[];

  const notificationById = new Map(
    notifications.map((notification) => [
      String(notification._id),
      notification,
    ]),
  );

  const visibleItems = visibleEntries.flatMap((entry) => {
    const notification = notificationById.get(String(entry.notificationId));
    if (!notification) return [];

    return [
      {
        notificationId: String(notification._id),
        businessId: String(notification.businessId),
        notificationType: notification.notificationType,
        message: notification.message,
        createdAt: notification.createdAt.toISOString(),
        read: entry.readFlag === true,
      },
    ];
  });

  visibleItems.sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) ||
      b.notificationId.localeCompare(a.notificationId),
  );

  const start = (page - 1) * limit;
  const items = visibleItems.slice(start, start + limit);

  return {
    items,
    unreadCount: visibleItems.filter((item) => !item.read).length,
    page,
    limit,
    hasMore: start + limit < visibleItems.length,
  };
};

const visibleNotificationIds = async (
  userId: string,
): Promise<Types.ObjectId[]> => {
  const entries = await loadVisibleEntries(userId);

  if (entries.length === 0) return [];

  const notifications = (await Notification.find(
    withSoftDeleteFilter({
      _id: { $in: entries.map((entry) => entry.notificationId) },
    }),
  )
    .select("_id")
    .lean()) as Array<{ _id: Types.ObjectId }>;

  return notifications.map((notification) => notification._id);
};

export const markRead = async ({
  userId,
  notificationId,
}: EntryActionInput): Promise<INotificationInboxReadResponse> => {
  await updateCallerEntry(userId, notificationId, {
    "notifications.$.readFlag": true,
  });

  return { notificationId, read: true };
};

export const markAllRead = async (
  userId: string,
): Promise<INotificationInboxUnreadCountResponse> => {
  const notificationIds = await visibleNotificationIds(userId);

  if (notificationIds.length > 0) {
    await User.updateOne(
      { _id: new Types.ObjectId(userId) },
      { $set: { "notifications.$[entry].readFlag": true } },
      {
        arrayFilters: [
          {
            "entry.notificationId": { $in: notificationIds },
            "entry.deletedFlag": { $ne: true },
          },
        ],
      },
    );
  }

  return { unreadCount: 0 };
};

export const hide = async ({
  userId,
  notificationId,
}: EntryActionInput): Promise<INotificationInboxHideResponse> => {
  await updateCallerEntry(userId, notificationId, {
    "notifications.$.deletedFlag": true,
    "notifications.$.readFlag": true,
  });

  return { notificationId, hidden: true };
};

const notificationInbox = { listInbox, markRead, markAllRead, hide };

export default notificationInbox;

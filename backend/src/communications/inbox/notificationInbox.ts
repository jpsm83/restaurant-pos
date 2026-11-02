/**
 * Notification inbox reads.
 *
 * The recipient is always the authenticated caller id passed by the route; no
 * request input selects a person. Entries are joined to their notification
 * records, per-person hidden entries and soft-deleted records are dropped, and
 * the result is ordered by notification creation time with a deterministic
 * notification-id tie-breaker.
 */
import { Types } from "mongoose";
import type { INotificationInboxResponse } from "restaurant-pos-packages/interfaces/INotification";

import Notification from "../../models/notification.ts";
import User from "../../models/user.ts";
import { withSoftDeleteFilter } from "../../models/softDelete.ts";

interface ListInboxInput {
  userId: string;
  page: number;
  limit: number;
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

/**
 * List one person's visible inbox page. The unread count covers every visible
 * entry, not only the current page.
 */
export const listInbox = async ({
  userId,
  page,
  limit,
}: ListInboxInput): Promise<INotificationInboxResponse> => {
  const user = (await User.findById(userId)
    .select("notifications")
    .lean()) as { notifications?: InboxEntry[] } | null;

  const visibleEntries = (user?.notifications ?? []).filter(
    (entry) => entry.notificationId && entry.deletedFlag !== true,
  );

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

const notificationInbox = { listInbox };

export default notificationInbox;

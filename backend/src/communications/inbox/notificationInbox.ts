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
import { Types, type PipelineStage } from "mongoose";
import type {
  INotificationInboxHideResponse,
  INotificationInboxReadResponse,
  INotificationInboxResponse,
  INotificationInboxUnreadCountResponse,
} from "restaurant-pos-packages/interfaces/INotification";
import { resolveStoredNotificationContent } from "restaurant-pos-packages/interfaces/INotification";

import Notification from "../../models/notification.ts";
import User from "../../models/user.ts";
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

interface InboxItemRow {
  notificationId: Types.ObjectId;
  businessId: Types.ObjectId;
  notificationType: string;
  content?: unknown;
  message?: string;
  createdAt: Date;
  read: boolean;
}

interface InboxFacetRow {
  items: InboxItemRow[];
  meta: Array<{ total: number; unreadCount: number }>;
}

/**
 * Stages shared by the inbox read and mark-all-read: start from the caller's
 * single User row, drop per-person hidden entries, and join only active
 * notification records by `_id`. Joining and paging happen inside MongoDB so a
 * large inbox never crosses the wire in full.
 */
const visibleEntryStages = (userId: string): PipelineStage[] => [
  { $match: { _id: new Types.ObjectId(userId) } },
  { $unwind: "$notifications" },
  {
    $match: {
      "notifications.notificationId": { $ne: null },
      "notifications.deletedFlag": { $ne: true },
    },
  },
  {
    $lookup: {
      from: Notification.collection.name,
      let: { notificationId: "$notifications.notificationId" },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ["$_id", "$$notificationId"] },
            deleted: { $ne: true },
          },
        },
        {
          $project: {
            _id: 1,
            businessId: 1,
            notificationType: 1,
            content: 1,
            message: 1,
            createdAt: 1,
          },
        },
      ],
      as: "notification",
    },
  },
  { $unwind: "$notification" },
];

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
 * List one person's visible inbox page. Sorting, pagination, and the unread
 * count all run in MongoDB; only the requested page's rows leave the server.
 * The unread count covers every visible entry, not only the current page.
 */
export const listInbox = async ({
  userId,
  page,
  limit,
}: ListInboxInput): Promise<INotificationInboxResponse> => {
  const start = (page - 1) * limit;

  const [result] = await User.aggregate<InboxFacetRow>(
    [
      ...visibleEntryStages(userId),
      { $sort: { "notification.createdAt": -1, "notification._id": -1 } },
      {
        $facet: {
          items: [
            { $skip: start },
            { $limit: limit },
            {
              $project: {
                _id: 0,
                notificationId: "$notification._id",
                businessId: "$notification.businessId",
                notificationType: "$notification.notificationType",
                content: "$notification.content",
                message: "$notification.message",
                createdAt: "$notification.createdAt",
                read: { $eq: ["$notifications.readFlag", true] },
              },
            },
          ],
          meta: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                unreadCount: {
                  $sum: {
                    $cond: [
                      { $eq: ["$notifications.readFlag", true] },
                      0,
                      1,
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    ],
    { allowDiskUse: true },
  ).exec();

  const items = (result?.items ?? []).map((item) => ({
    notificationId: String(item.notificationId),
    businessId: String(item.businessId),
    notificationType: item.notificationType,
    content: resolveStoredNotificationContent(item.content, item.message),
    createdAt: new Date(item.createdAt).toISOString(),
    read: item.read === true,
  }));
  const total = result?.meta[0]?.total ?? 0;

  return {
    items,
    unreadCount: result?.meta[0]?.unreadCount ?? 0,
    page,
    limit,
    hasMore: start + items.length < total,
  };
};

const visibleNotificationIds = async (
  userId: string,
): Promise<Types.ObjectId[]> => {
  const rows = await User.aggregate<{ notificationId: Types.ObjectId }>(
    [
      ...visibleEntryStages(userId),
      { $project: { _id: 0, notificationId: "$notification._id" } },
    ],
    { allowDiskUse: true },
  ).exec();

  return rows.map((row) => row.notificationId);
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

import type { NotificationItem } from "../types";

interface NotificationCounters {
  unreadCount: number;
  deletedCount: number;
}

let lastInputRef: NotificationItem[] | null = null;
let lastResult: NotificationCounters = { unreadCount: 0, deletedCount: 0 };

export const selectNotificationCounters = (
  items: NotificationItem[]
): NotificationCounters => {
  if (items === lastInputRef) return lastResult;

  let unreadCount = 0;
  let deletedCount = 0;
  for (const item of items) {
    if (item.deletedFlag) {
      deletedCount += 1;
      continue;
    }
    if (!item.readFlag) {
      unreadCount += 1;
    }
  }

  lastInputRef = items;
  lastResult = { unreadCount, deletedCount };
  return lastResult;
};


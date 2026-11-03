import type { NotificationContent } from "restaurant-pos-packages/interfaces/INotification";
import { isNotificationContent } from "restaurant-pos-packages/interfaces/INotification";

/**
 * Reject anything that is not the template/text shape. The notification
 * service is the only write path, so this is the one guard that keeps arbitrary
 * free-form copy out of stored notifications.
 */
export function assertNotificationContent(
  content: unknown,
): asserts content is NotificationContent {
  if (!isNotificationContent(content)) {
    throw new Error("Notification content must be template or text");
  }
}

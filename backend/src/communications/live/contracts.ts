import type { NotificationContent } from "restaurant-pos-packages/interfaces/INotification";
import type { LiveInAppNotificationEvent } from "../types.ts";

export interface LiveConnectedMessage {
  type: "live.connected";
  data: { accountId: string };
}

export interface NotificationCreatedMessage {
  type: "notification.created";
  data: {
    notificationId: string;
    businessId: string;
    content: NotificationContent;
    notificationType: LiveInAppNotificationEvent["notificationType"];
    correlationId: string;
  };
}

export const toLiveConnectedMessage = (
  accountId: string
): LiveConnectedMessage => ({
  type: "live.connected",
  data: { accountId },
});

export const toNotificationCreatedMessage = (
  event: LiveInAppNotificationEvent
): NotificationCreatedMessage => ({
  type: "notification.created",
  data: {
    notificationId: event.notificationId.toString(),
    businessId: event.businessId.toString(),
    content: event.content,
    notificationType: event.notificationType,
    correlationId:
      event.correlationId ??
      `live-${event.notificationId.toString()}-${Date.now()}`,
  },
});


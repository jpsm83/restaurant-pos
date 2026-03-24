import type { LiveInAppNotificationEvent } from "../types.ts";

export interface NotificationLiveConnectedMessage {
  type: "notification.live.connected";
  data: { userId: string };
}

export interface NotificationCreatedMessage {
  type: "notification.created";
  data: {
    notificationId: string;
    businessId: string;
    message: string;
    notificationType: LiveInAppNotificationEvent["notificationType"];
    correlationId: string;
  };
}

export const toLiveConnectedMessage = (
  userId: string
): NotificationLiveConnectedMessage => ({
  type: "notification.live.connected",
  data: { userId },
});

export const toNotificationCreatedMessage = (
  event: LiveInAppNotificationEvent
): NotificationCreatedMessage => ({
  type: "notification.created",
  data: {
    notificationId: event.notificationId.toString(),
    businessId: event.businessId.toString(),
    message: event.message,
    notificationType: event.notificationType,
    correlationId:
      event.correlationId ??
      `live-${event.notificationId.toString()}-${Date.now()}`,
  },
});


import type { CommunicationsChannelResult, InAppSendInput } from "../types.ts";
import notificationService from "../services/notificationService.ts";
import { isNotificationContent } from "restaurant-pos-packages/interfaces/INotification";

const LOG_PREFIX = "[communications][inAppChannel]";

const send = async (payload: InAppSendInput): Promise<CommunicationsChannelResult> => {
  try {
    if (!isNotificationContent(payload.content)) {
      return {
        channel: "inApp",
        success: false,
        sentCount: 0,
        deliveryMode: "persisted",
        error: "Notification content must be template or text",
      };
    }

    const delivered = await notificationService.createAndDeliver({
      content: payload.content,
      notificationType: payload.notificationType ?? "Info",
      businessId: payload.businessId,
      recipients: payload.recipients,
      eventName: payload.eventName,
      correlationId: payload.correlationId,
      session: payload.session,
    });

    console.info(
      `${LOG_PREFIX} Notification persisted eventName=${payload.eventName ?? "UNKNOWN"} businessId=${payload.businessId.toString()} recipientCount=${delivered.recipientCount} correlationId=${payload.correlationId ?? "N/A"}`
    );

    return {
      channel: "inApp",
      success: true,
      sentCount: delivered.recipientCount,
      deliveryMode: "persisted",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown in-app channel error";

    console.error(
      `${LOG_PREFIX} Notification send failed eventName=${payload.eventName ?? "UNKNOWN"} businessId=${payload.businessId.toString()} correlationId=${payload.correlationId ?? "N/A"}`,
      error
    );

    if (payload.fireAndForget) {
      return {
        channel: "inApp",
        success: false,
        sentCount: 0,
        deliveryMode: "persisted",
        error: message,
      };
    }

    throw error;
  }
};

const inAppChannel = { send };

export default inAppChannel;


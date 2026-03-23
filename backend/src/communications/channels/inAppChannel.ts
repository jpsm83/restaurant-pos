import type { CommunicationsChannelResult, InAppSendInput } from "../types.ts";
import { emitLiveInAppNotification } from "./liveInAppEvents.ts";
import notificationRepository from "../repositories/notificationRepository.ts";

const LOG_PREFIX = "[communications][inAppChannel]";

const send = async (payload: InAppSendInput): Promise<CommunicationsChannelResult> => {
  try {
    if (!payload.message?.trim()) {
      return {
        channel: "inApp",
        success: false,
        sentCount: 0,
        deliveryMode: "persisted",
        error: "Notification message is required",
      };
    }

    const fanout = await notificationRepository.createAndFanout({
      message: payload.message,
      notificationType: payload.notificationType ?? "Info",
      businessId: payload.businessId,
      recipients: payload.recipients,
      session: payload.session,
    });

    emitLiveInAppNotification({
      notificationId: fanout.notificationId,
      businessId: payload.businessId,
      message: payload.message,
      notificationType: payload.notificationType ?? "Info",
      recipientUserIds: fanout.recipientUserIds,
      eventName: payload.eventName,
      correlationId: payload.correlationId,
    });

    console.info(
      `${LOG_PREFIX} Notification persisted eventName=${payload.eventName ?? "UNKNOWN"} businessId=${payload.businessId.toString()} recipientCount=${fanout.recipientCount} correlationId=${payload.correlationId ?? "N/A"}`
    );

    return {
      channel: "inApp",
      success: true,
      sentCount: fanout.recipientCount,
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


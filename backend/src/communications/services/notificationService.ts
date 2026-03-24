import resolveCustomerUserRecipient from "../recipientResolvers/resolveCustomerUserRecipient.ts";
import resolveEmployeeUserRecipients from "../recipientResolvers/resolveEmployeeUserRecipients.ts";
import { toUniqueObjectIds } from "../recipientResolvers/utils.ts";
import notificationRepository from "../repositories/notificationRepository.ts";
import { emitLiveInAppNotification } from "../channels/liveInAppEvents.ts";
import type {
  NotificationCreateAndDeliverInput,
  NotificationCreateAndDeliverResult,
} from "../types.ts";

const createAndDeliver = async (
  input: NotificationCreateAndDeliverInput
): Promise<NotificationCreateAndDeliverResult> => {
  if (!input.message?.trim()) {
    throw new Error("Notification message is required");
  }

  if (!input.businessId) {
    throw new Error("Business id is required");
  }

  const customerUserIds = resolveCustomerUserRecipient(
    input.recipients.customerUserIds
  );
  const { employeeIds, employeeUserIds } = await resolveEmployeeUserRecipients({
    employeeIds: input.recipients.employeeIds,
    employeeUserIds: input.recipients.employeeUserIds,
    session: input.session,
  });

  const recipientUserIds = toUniqueObjectIds([
    ...customerUserIds,
    ...employeeUserIds,
  ]);

  if (recipientUserIds.length === 0) {
    throw new Error("No recipients resolved for notification delivery");
  }

  const fanout = await notificationRepository.createAndFanoutResolved({
    message: input.message,
    businessId: input.businessId,
    recipients: { customerUserIds, employeeIds, recipientUserIds },
    notificationType: input.notificationType,
    senderId: input.senderId,
    session: input.session,
  });

  emitLiveInAppNotification({
    notificationId: fanout.notificationId,
    businessId: input.businessId,
    message: input.message,
    notificationType: input.notificationType ?? "Info",
    recipientUserIds: fanout.recipientUserIds,
    eventName: input.eventName,
    correlationId: input.correlationId,
  });

  return {
    ...fanout,
    eventName: input.eventName,
    correlationId: input.correlationId,
    emittedLiveEvent: true,
  };
};

const notificationService = { createAndDeliver };

export default notificationService;


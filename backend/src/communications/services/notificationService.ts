import resolveCustomerUserRecipient from "../recipientResolvers/resolveCustomerUserRecipient.ts";
import resolveEmployeeUserRecipients from "../recipientResolvers/resolveEmployeeUserRecipients.ts";
import { toUniqueObjectIds } from "../recipientResolvers/utils.ts";
import notificationRepository from "../repositories/notificationRepository.ts";
import { emitLiveInAppNotification } from "../channels/liveInAppEvents.ts";
import { runAfterCommit } from "../live/afterCommit.ts";
import type {
  NotificationAddRecipientsInput,
  NotificationAddRecipientsResult,
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

  // Push only after the store has committed. Inside an open transaction the
  // push is held until commit; with no transaction it follows the write.
  const pushDeferredUntilCommit = Boolean(input.session?.inTransaction());
  runAfterCommit(input.session, () => {
    emitLiveInAppNotification({
      notificationId: fanout.notificationId,
      businessId: input.businessId,
      message: input.message,
      notificationType: input.notificationType ?? "Info",
      recipientUserIds: fanout.recipientUserIds,
      eventName: input.eventName,
      correlationId: input.correlationId,
    });
  });

  return {
    ...fanout,
    eventName: input.eventName,
    correlationId: input.correlationId,
    // False while the push is still held for an open transaction; the emit
    // happens on commit, not during this call.
    emittedLiveEvent: !pushDeferredUntilCommit,
  };
};

/**
 * Adds newly addressed people to a notification that already exists, using the
 * same store-then-push rail as a new notification.
 *
 * The existing notification stays the one notification: this never inserts a
 * second notification. It stores one unread, not-deleted inbox entry only for
 * people who do not already hold one, then pushes that same stored notification
 * to each open connection of the newly stored people after the store commits.
 * A person who already holds the entry is not stored again and is not pushed
 * again. An aborted transaction leaves no entry and no push.
 */
const addRecipientsAndDeliver = async (
  input: NotificationAddRecipientsInput,
): Promise<NotificationAddRecipientsResult> => {
  if (!input.businessId) {
    throw new Error("Business id is required");
  }

  // Store inbox entries only for people who do not already hold one on this
  // same notification, so a repeat add is neither stored nor pushed again.
  const { newlyAddedUserIds } = await notificationRepository.addRecipientsFanout({
    notificationId: input.notificationId,
    recipientUserIds: input.recipientUserIds,
    session: input.session,
  });

  // Nobody newly addressed: nothing stored, nothing pushed.
  if (newlyAddedUserIds.length === 0) {
    return {
      notificationId: input.notificationId,
      newlyAddedUserIds: [],
      emittedLiveEvent: false,
    };
  }

  // Push the existing notification to the newly addressed people only, and only
  // after the store has committed. Inside an open transaction the push is held
  // until commit; with no transaction it follows the write.
  const pushDeferredUntilCommit = Boolean(input.session?.inTransaction());
  runAfterCommit(input.session, () => {
    emitLiveInAppNotification({
      notificationId: input.notificationId,
      businessId: input.businessId,
      message: input.message,
      notificationType: input.notificationType ?? "Info",
      recipientUserIds: newlyAddedUserIds,
      eventName: input.eventName,
      correlationId: input.correlationId,
    });
  });

  return {
    notificationId: input.notificationId,
    newlyAddedUserIds,
    emittedLiveEvent: !pushDeferredUntilCommit,
  };
};

const notificationService = { createAndDeliver, addRecipientsAndDeliver };

export default notificationService;


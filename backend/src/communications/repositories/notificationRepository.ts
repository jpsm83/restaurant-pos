import { Types } from "mongoose";
import type { ClientSession } from "mongoose";
import type { NotificationContent } from "restaurant-pos-packages/interfaces/INotification";
import Notification from "../../models/notification.ts";
import User from "../../models/user.ts";
import type {
  CommunicationsRecipientTarget,
  NotificationFanoutResult,
  NotificationType,
} from "../types.ts";
import { resolveStoredNotificationContent } from "restaurant-pos-packages/interfaces/INotification";
import { assertNotificationContent } from "../notificationContent.ts";
import resolveCustomerUserRecipient from "../recipientResolvers/resolveCustomerUserRecipient.ts";
import resolveEmployeeUserRecipients from "../recipientResolvers/resolveEmployeeUserRecipients.ts";
import { toUniqueObjectIds } from "../recipientResolvers/utils.ts";

interface CreateAndFanoutResolvedInput {
  content: NotificationContent;
  businessId: Types.ObjectId;
  recipients: {
    customerUserIds: Types.ObjectId[];
    employeeIds: Types.ObjectId[];
    recipientUserIds: Types.ObjectId[];
  };
  notificationType?: NotificationType;
  senderId?: Types.ObjectId;
  session?: ClientSession;
}

interface CreateAndFanoutInput {
  content: NotificationContent;
  businessId: Types.ObjectId;
  recipients: CommunicationsRecipientTarget;
  notificationType?: NotificationType;
  senderId?: Types.ObjectId;
  session?: ClientSession;
}

interface AddRecipientsFanoutInput {
  notificationId: Types.ObjectId;
  recipientUserIds: Types.ObjectId[];
  session?: ClientSession;
}

export const createAndFanoutResolved = async (
  input: CreateAndFanoutResolvedInput
): Promise<NotificationFanoutResult> => {
  const {
    customerUserIds,
    employeeIds,
    recipientUserIds,
  } = input.recipients;

  if (recipientUserIds.length === 0) {
    throw new Error("No recipients resolved for notification fanout");
  }

  assertNotificationContent(input.content);

  const [createdNotification] = await Notification.create(
    [
      {
        notificationType: input.notificationType ?? "Info",
        content: input.content,
        businessId: input.businessId,
        senderId: input.senderId ?? undefined,
        employeesRecipientsIds: employeeIds.length > 0 ? employeeIds : undefined,
        customersRecipientsIds:
          customerUserIds.length > 0 || recipientUserIds.length > 0
            ? recipientUserIds
            : undefined,
      },
    ],
    input.session ? { session: input.session } : undefined
  );

  if (!createdNotification?._id) {
    throw new Error("Notification creation failed");
  }

  await User.updateMany(
    { _id: { $in: recipientUserIds } },
    {
      $push: {
        notifications: {
          notificationId: createdNotification._id,
          readFlag: false,
          deletedFlag: false,
        },
      },
    },
    input.session ? { session: input.session } : undefined
  );

  return {
    notificationId: createdNotification._id,
    recipientUserIds,
    recipientCount: recipientUserIds.length,
  };
};

export const createAndFanout = async (
  input: CreateAndFanoutInput
): Promise<NotificationFanoutResult> => {
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

  return createAndFanoutResolved({
    content: input.content,
    businessId: input.businessId,
    recipients: { customerUserIds, employeeIds, recipientUserIds },
    notificationType: input.notificationType,
    senderId: input.senderId,
    session: input.session,
  });
};

/**
 * Fans out inbox entries for people newly addressed on a notification that
 * already exists, keeping that one notification. Entries are stored only for
 * users who do not already hold one on this notification, so a repeat add is
 * not stored again. Returns the users that were newly stored.
 */
export const addRecipientsFanout = async (
  input: AddRecipientsFanoutInput
): Promise<{ newlyAddedUserIds: Types.ObjectId[] }> => {
  const candidateUserIds = toUniqueObjectIds(input.recipientUserIds ?? []);

  if (candidateUserIds.length === 0) {
    return { newlyAddedUserIds: [] };
  }

  const alreadyHolding = await User.find(
    {
      _id: { $in: candidateUserIds },
      "notifications.notificationId": input.notificationId,
    },
    { _id: 1 }
  )
    .session(input.session ?? null)
    .lean();

  const alreadyHoldingSet = new Set(
    alreadyHolding.map((user) => String(user._id))
  );
  const newlyAddedUserIds = candidateUserIds.filter(
    (id) => !alreadyHoldingSet.has(String(id))
  );

  if (newlyAddedUserIds.length === 0) {
    return { newlyAddedUserIds: [] };
  }

  await User.updateMany(
    { _id: { $in: newlyAddedUserIds } },
    {
      $push: {
        notifications: {
          notificationId: input.notificationId,
          readFlag: false,
          deletedFlag: false,
        },
      },
    },
    input.session ? { session: input.session } : undefined
  );

  return { newlyAddedUserIds };
};

/**
 * Reads the stored content and severity for a notification so an added
 * recipient is pushed the same machine-readable content that was persisted.
 * Legacy rows fall back to their `message` as literal text.
 */
export const findNotificationPushContent = async (
  notificationId: Types.ObjectId,
  session?: ClientSession,
): Promise<{
  content: NotificationContent;
  notificationType: NotificationType;
} | null> => {
  const notification = await Notification.findById(notificationId)
    .session(session ?? null)
    .select("content message notificationType")
    .lean<{
      content?: unknown;
      message?: string;
      notificationType?: string;
    }>();

  if (!notification) return null;

  return {
    content: resolveStoredNotificationContent(
      notification.content,
      notification.message,
    ),
    notificationType:
      (notification.notificationType as NotificationType | undefined) ?? "Info",
  };
};

const notificationRepository = {
  createAndFanout,
  createAndFanoutResolved,
  addRecipientsFanout,
  findNotificationPushContent,
};

export default notificationRepository;


import type { Types } from "mongoose";

/**
 * Stable machine-readable notification content.
 *
 * A system-generated notification stores a template key plus parameters; the
 * recipient's UI renders the key in the active language. A literal text
 * notification stores copy exactly as authored and is never translated.
 */
export const NOTIFICATION_TEMPLATE_KEYS = [
  "notifications.templates.orderConfirmed",
  "notifications.templates.reservationPending",
  "notifications.templates.reservationPendingManager",
  "notifications.templates.reservationConfirmed",
  "notifications.templates.reservationCancelled",
  "notifications.templates.lowStock",
  "notifications.templates.monthlyReportReady",
  "notifications.templates.weeklyReportReady",
  "notifications.templates.businessProfileUpdated",
] as const;

export type NotificationTemplateKey = (typeof NOTIFICATION_TEMPLATE_KEYS)[number];

export interface NotificationTemplateContent {
  kind: "template";
  key: NotificationTemplateKey;
  params: Record<string, unknown>;
}

export interface NotificationTextContent {
  kind: "text";
  text: string;
}

export type NotificationContent =
  | NotificationTemplateContent
  | NotificationTextContent;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function isNotificationTemplateKey(
  value: unknown,
): value is NotificationTemplateKey {
  return (
    typeof value === "string" &&
    (NOTIFICATION_TEMPLATE_KEYS as readonly string[]).includes(value)
  );
}

/**
 * True only for the two accepted content shapes. A bare string or an unknown
 * template key is not notification content, so free-form copy cannot slip in
 * where a machine-readable shape is expected.
 */
export function isNotificationContent(
  value: unknown,
): value is NotificationContent {
  if (!isRecord(value)) return false;

  if (value.kind === "text") {
    return typeof value.text === "string" && value.text.trim().length > 0;
  }

  if (value.kind === "template") {
    return isNotificationTemplateKey(value.key) && isRecord(value.params);
  }

  return false;
}

/**
 * Resolve stored content, falling back to the legacy English `message` as
 * literal text. Used when reading rows written before the content shape.
 */
export function resolveStoredNotificationContent(
  content: unknown,
  legacyMessage?: string | null,
): NotificationContent {
  if (isNotificationContent(content)) return content;
  return { kind: "text", text: legacyMessage ?? "" };
}

export interface INotification {
  _id?: Types.ObjectId;
  notificationType: string;
  /** Machine-readable content. Legacy rows may carry only `message`. */
  content?: NotificationContent;
  /** Legacy English copy, readable as a `text` fallback. */
  message?: string;
  employeesRecipientsIds: Types.ObjectId[];
  customersRecipientsIds: Types.ObjectId[];
  businessId: Types.ObjectId;
  senderId?: Types.ObjectId;
  deleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
}

/** One visible entry in a person's inbox, with their own read state. */
export interface INotificationInboxItem {
  notificationId: string;
  businessId: string;
  notificationType: string;
  content: NotificationContent;
  createdAt: string;
  read: boolean;
}

/** The authenticated caller's inbox page. */
export interface INotificationInboxResponse {
  items: INotificationInboxItem[];
  unreadCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/** The caller's entry was marked read. */
export interface INotificationInboxReadResponse {
  notificationId: string;
  read: true;
}

/** The resulting unread count after marking every visible entry read. */
export interface INotificationInboxUnreadCountResponse {
  unreadCount: number;
}

/** The caller's entry was hidden from their inbox. */
export interface INotificationInboxHideResponse {
  notificationId: string;
  hidden: true;
}

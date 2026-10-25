import { Types } from "mongoose";
import type { ClientSession } from "mongoose";

export type CommunicationsChannel = "email" | "inApp" | "liveInApp";

export type NotificationType =
  | "Info"
  | "Warning"
  | "Emergency"
  | "Message"
  | "Promotion"
  | "Birthday"
  | "Event";

export type CommunicationsEventName =
  | "ORDER_CONFIRMED"
  | "RESERVATION_PENDING"
  | "RESERVATION_DECIDED"
  | "LOW_STOCK_ALERT"
  | "MONTHLY_REPORT_READY"
  | "WEEKLY_REPORT_READY"
  | "BUSINESS_PROFILE_UPDATED";

export interface OrderConfirmedEventPayload {
  businessId: Types.ObjectId;
  userId: Types.ObjectId;
  dailyReferenceNumber: string | number;
  totalNetPaidAmount: number;
  orderCount: number;
  orderCode?: string;
  flow?: "delivery" | "selfOrder";
  clientName?: string;
  deliveryAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

export interface ReservationPendingEventPayload {
  businessId: Types.ObjectId;
  userId: Types.ObjectId;
  reservationId: Types.ObjectId;
  reservationStart: Date;
  guestCount: number;
  description?: string;
}

export interface ReservationDecidedEventPayload {
  businessId: Types.ObjectId;
  userId: Types.ObjectId;
  reservationId: Types.ObjectId;
  reservationStart: Date;
  guestCount: number;
  description?: string;
  status: "Confirmed" | "Cancelled";
}

export interface LowStockItemPayload {
  supplierGoodId: Types.ObjectId;
  name: string;
  currentCount: number;
  threshold: number;
}

export interface LowStockAlertEventPayload {
  businessId: Types.ObjectId;
  lowStockItems: LowStockItemPayload[];
}

export interface MonthlyReportReadyEventPayload {
  businessId: Types.ObjectId;
  monthLabel: string;
}

export interface WeeklyReportReadyEventPayload {
  businessId: Types.ObjectId;
  weekLabel: string;
}

export interface BusinessProfileUpdatedEventPayload {
  businessId: Types.ObjectId;
  actor: {
    userId?: Types.ObjectId;
    employeeId?: Types.ObjectId;
    email?: string;
    role?: string;
    source: "businessOwner" | "manager" | "system";
  };
  changedFields: string[];
  changedFieldCount: number;
  occurredAt: Date;
  context?: {
    correlationId?: string;
    operationId?: string;
    requestPath?: string;
    requestMethod?: string;
  };
}

export interface CommunicationsEventPayloadMap {
  ORDER_CONFIRMED: OrderConfirmedEventPayload;
  RESERVATION_PENDING: ReservationPendingEventPayload;
  RESERVATION_DECIDED: ReservationDecidedEventPayload;
  LOW_STOCK_ALERT: LowStockAlertEventPayload;
  MONTHLY_REPORT_READY: MonthlyReportReadyEventPayload;
  WEEKLY_REPORT_READY: WeeklyReportReadyEventPayload;
  BUSINESS_PROFILE_UPDATED: BusinessProfileUpdatedEventPayload;
}

export type CommunicationsEventPayload<E extends CommunicationsEventName> =
  CommunicationsEventPayloadMap[E];

export interface CommunicationsRecipientTarget {
  customerUserIds?: Types.ObjectId[];
  employeeIds?: Types.ObjectId[];
  employeeUserIds?: Types.ObjectId[];
}

export interface CommunicationsDispatchOptions {
  fireAndForget?: boolean;
  correlationId?: string;
  preferredChannels?: CommunicationsChannel[];
  idempotencyKey?: string;
  idempotencyWindowMs?: number;
}

export interface CommunicationsChannelResult {
  channel: CommunicationsChannel;
  success: boolean;
  error?: string;
  sentCount?: number;
  deliveryMode?: "persisted" | "livePush";
}

export interface CommunicationsDispatchResult {
  eventName: CommunicationsEventName;
  success: boolean;
  channels: CommunicationsChannelResult[];
  correlationId?: string;
}

export interface EmailSendInput {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  /** Sender display name. Blank or omitted uses the platform display name. */
  displayName?: string;
  eventName?: CommunicationsEventName;
  businessId?: Types.ObjectId;
  correlationId?: string;
}

export interface InAppSendInput {
  message: string;
  notificationType?: NotificationType;
  businessId: Types.ObjectId;
  recipients: CommunicationsRecipientTarget;
  eventName?: CommunicationsEventName;
  correlationId?: string;
  fireAndForget?: boolean;
  session?: ClientSession;
}

export interface NotificationFanoutResult {
  notificationId: Types.ObjectId;
  recipientUserIds: Types.ObjectId[];
  recipientCount: number;
}

export interface NotificationCreateAndDeliverInput {
  message: string;
  businessId: Types.ObjectId;
  recipients: CommunicationsRecipientTarget;
  notificationType?: NotificationType;
  senderId?: Types.ObjectId;
  eventName?: CommunicationsEventName;
  correlationId?: string;
  session?: ClientSession;
}

export interface NotificationCreateAndDeliverResult extends NotificationFanoutResult {
  eventName?: CommunicationsEventName;
  correlationId?: string;
  /**
   * True when the live event was emitted during this call. False when the push
   * is held for an open transaction and only emitted once that transaction
   * commits.
   */
  emittedLiveEvent: boolean;
}

export interface NotificationAddRecipientsInput {
  notificationId: Types.ObjectId;
  businessId: Types.ObjectId;
  message: string;
  recipientUserIds: Types.ObjectId[];
  notificationType?: NotificationType;
  eventName?: CommunicationsEventName;
  correlationId?: string;
  session?: ClientSession;
}

export interface NotificationAddRecipientsResult {
  notificationId: Types.ObjectId;
  /**
   * The resolved user ids that were newly stored on this call. People who
   * already held the inbox entry are excluded, so they are neither stored nor
   * pushed again.
   */
  newlyAddedUserIds: Types.ObjectId[];
  /**
   * True when the live event was emitted during this call. False when nobody
   * was newly added, or when the push is held for an open transaction and only
   * emitted once that transaction commits.
   */
  emittedLiveEvent: boolean;
}

export interface LiveInAppNotificationEvent {
  notificationId: Types.ObjectId;
  businessId: Types.ObjectId;
  message: string;
  notificationType: NotificationType;
  recipientUserIds: Types.ObjectId[];
  eventName?: CommunicationsEventName;
  correlationId?: string;
}

export interface LiveInAppSendInput extends LiveInAppNotificationEvent {}


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
  | "WEEKLY_REPORT_READY";

export interface OrderConfirmedEventPayload {
  businessId: Types.ObjectId;
  userId: Types.ObjectId;
  dailyReferenceNumber: string | number;
  totalNetPaidAmount: number;
  orderCount: number;
  orderCode?: string;
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

export interface CommunicationsEventPayloadMap {
  ORDER_CONFIRMED: OrderConfirmedEventPayload;
  RESERVATION_PENDING: ReservationPendingEventPayload;
  RESERVATION_DECIDED: ReservationDecidedEventPayload;
  LOW_STOCK_ALERT: LowStockAlertEventPayload;
  MONTHLY_REPORT_READY: MonthlyReportReadyEventPayload;
  WEEKLY_REPORT_READY: WeeklyReportReadyEventPayload;
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
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  eventName?: CommunicationsEventName;
  businessId?: Types.ObjectId;
  correlationId?: string;
  fireAndForget?: boolean;
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


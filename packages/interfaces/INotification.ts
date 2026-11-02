import type { Types } from "mongoose";

export interface INotification {
  _id?: Types.ObjectId;
  notificationType: string;
  message: string;
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
  message: string;
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

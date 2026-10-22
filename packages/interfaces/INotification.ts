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
}
import type { Types } from "mongoose";
import { IPersonalDetails } from "./IPersonalDetails.js";

interface INotification {
    notificationId: Types.ObjectId;
    readFlag?: boolean;
    deletedFlag?: boolean;
  }

export interface IUser {
  _id?: Types.ObjectId;
  personalDetails: IPersonalDetails;
  selfOrders?: Types.ObjectId[]; // References to Order model
  notifications?: INotification[];
  verificationToken?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  refreshSessionVersion?: number;
  deleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
}
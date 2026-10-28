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
  /** `en` or `es`; unset until the person chooses a language. */
  languagePreference?: "en" | "es";
  selfOrders?: Types.ObjectId[]; // References to Order model
  notifications?: INotification[];
  verificationToken?: string;
  verificationTokenExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  refreshSessionVersion?: number;
  deleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
}
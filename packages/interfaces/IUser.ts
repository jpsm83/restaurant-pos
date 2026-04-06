import { Types } from "mongoose";
import { IPersonalDetails } from "./IPersonalDetails.js";

interface INotification {
    notificationId: Types.ObjectId;
    readFlag?: boolean;
    deletedFlag?: boolean;
  }

export interface IUser {
  _id?: Types.ObjectId;
  personalDetails: IPersonalDetails;
  employeeDetails?: Types.ObjectId; // Reference to Employee model
  selfOrders?: Types.ObjectId[]; // References to Order model
  notifications?: INotification[];
  /** Legacy root mirror; prefer `personalDetails.emailVerified` as source of truth. */
  emailVerified?: boolean;
  verificationToken?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
}
import { Types } from "mongoose";
import { IPersonalDetails } from "./IPersonalDetails";

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
  /** When true, `personalDetails.email` is treated as verified for auth-email flows. */
  emailVerified?: boolean;
  /** Digest of the raw email-confirmation token (e.g. SHA-256); optional. */
  emailVerificationTokenHash?: string;
  emailVerificationExpiresAt?: Date;
  /** Digest of the raw password-reset token; optional. */
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
}
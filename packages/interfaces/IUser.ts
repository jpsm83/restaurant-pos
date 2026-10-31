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
  /** Google subject; server-owned and unique among active users. */
  googleId?: string;
  selfOrders?: Types.ObjectId[]; // References to Order model
  notifications?: INotification[];
  verificationToken?: string;
  verificationTokenExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  /** Pending sign-in email change; the current email stays active until confirmed. */
  pendingEmail?: string;
  pendingEmailToken?: string;
  pendingEmailExpires?: Date;
  /** When the last email-change link was sent; drives the request cooldown. */
  pendingEmailRequestedAt?: Date;
  refreshSessionVersion?: number;
  /** Composite privacy-notice and account-terms acknowledgement. */
  privacyAccepted?: boolean;
  /** Server-set time of the acceptance; never client-supplied. */
  privacyAcceptedAt?: Date;
  /** Marketing consent, off by default and not client-editable in this slice. */
  marketingConsent?: boolean;
  /** When marketing consent was last granted or withdrawn; unset until then. */
  marketingConsentUpdatedAt?: Date;
  deleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
}
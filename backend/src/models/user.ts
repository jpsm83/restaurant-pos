import mongoose, { Schema, model } from "mongoose";
import { personalDetailsSchema } from "./personalDetails.ts";

const notificationEntrySchema = new Schema(
  {
    notificationId: {
      type: Schema.Types.ObjectId,
      ref: "Notification",
      required: true,
    },
    readFlag: { type: Boolean, default: false },
    deletedFlag: { type: Boolean, default: false },
  }
);

const userSchema = new Schema(
  {
    // required fields
    personalDetails: {
      type: personalDetailsSchema,
      required: [true, "Personal details are required!"],
    }, // personal details of the user

    // optional fields
    // Set only when this user is linked as an employee; kept in sync by employee create/update/delete.
    employeeDetails: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      default: undefined,
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // employee details of the user if he has an employee role
    selfOrders: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "Order",
          index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
        },
      ],
      default: undefined,
    }, // self orders made by the user if you are logged as Client
    notifications: { type: [notificationEntrySchema], default: undefined }, // notifications received by the user

    /**
     * Sign-in email lifecycle (`personalDetails.email`): verification + password reset tokens.
     * Hashed token values only (raw tokens live in outbound email). See `TODO-auth-email-security-flows-implementation.md`.
     * Existing documents without `emailVerified`: treat as verified in app logic or run a one-time backfill to `true`.
     */
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationTokenHash: { type: String, default: undefined },
    emailVerificationExpiresAt: { type: Date, default: undefined },
    passwordResetTokenHash: { type: String, default: undefined },
    passwordResetExpiresAt: { type: Date, default: undefined },
    /** Increment on password reset / password change to invalidate outstanding refresh JWTs. */
    refreshSessionVersion: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    trim: true,
  },
);

// Supports inbox lookup and joins from User.notifications to Notification.
userSchema.index({ "notifications.notificationId": 1 });

// Auth-email: `findOne({ emailVerificationTokenHash })` / password reset by hash (sparse — most rows have no token).
userSchema.index(
  { emailVerificationTokenHash: 1 },
  { sparse: true },
);
userSchema.index({ passwordResetTokenHash: 1 }, { sparse: true });

const User = mongoose.models.User || model("User", userSchema);
export default User;

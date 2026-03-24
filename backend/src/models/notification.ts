import mongoose, { Schema, model } from "mongoose";
import * as enums from "../../../lib/enums.ts";

const { notificationEnums } = enums;

const notificationSchema = new Schema(
  {
    // required fields
    notificationType: {
      type: String,
      required: [true, "NotificationType is required!"],
      enum: notificationEnums,
    }, // Type of notification "warning", "emergency", "info"
    message: { type: String, required: [true, "Message is required!"] }, // notification message
    employeesRecipientsIds: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "Employee",
        },
      ],
      default: undefined,
    }, // Reference to the employee receiving the notification
    customersRecipientsIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ], // Reference to the customer receiving the notification
    senderId: { type: Schema.Types.ObjectId, ref: "Employee" }, // Reference to the employee who created the notification, only used on messages
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
    }, // Reference to the business where the notification was created
  },
  {
    timestamps: true,
    trim: true,
  }
);

// Explicit index declarations for notification read patterns.
notificationSchema.index({ businessId: 1, createdAt: -1 });
notificationSchema.index({ customersRecipientsIds: 1, createdAt: -1 });
notificationSchema.index({ employeesRecipientsIds: 1, createdAt: -1 });

const Notification =
  mongoose.models.Notification ||
  model("Notification", notificationSchema);
export default Notification;

import mongoose, { Schema, model } from "mongoose";
import * as enums from "restaurant-pos-packages/enums";
import { applyActiveOnlySoftDelete, softDeleteSchemaFields } from "./softDelete.ts";

const { notificationEnums } = enums;

const notificationSchema = new Schema(
  {
    // required fields
    notificationType: {
      type: String,
      required: [true, "NotificationType is required!"],
      enum: notificationEnums,
    }, // Type of notification "warning", "emergency", "info"
    /**
     * Machine-readable content: either a stable template key plus parameters
     * resolved in the recipient's UI language, or literal text that is never
     * translated. Optional only so legacy rows that carry `message` stay
     * readable.
     */
    content: {
      kind: { type: String, enum: ["template", "text"] },
      key: { type: String },
      params: { type: Schema.Types.Mixed },
      text: { type: String },
    },
    /** Legacy English copy, read as a `text` fallback when `content` is absent. */
    message: { type: String },
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
    ...softDeleteSchemaFields,
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

applyActiveOnlySoftDelete(notificationSchema);

const Notification =
  mongoose.models.Notification ||
  model("Notification", notificationSchema);
export default Notification;

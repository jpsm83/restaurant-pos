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
          index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
        },
      ],
      default: undefined,
    }, // Reference to the employee receiving the notification
    customersRecipientsIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
      },
    ], // Reference to the customer receiving the notification
    senderId: { type: Schema.Types.ObjectId, ref: "Employee" }, // Reference to the employee who created the notification, only used on messages
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // Reference to the business where the notification was created
  },
  {
    timestamps: true,
    trim: true,
  }
);

const Notification =
  mongoose.models.Notification ||
  model("Notification", notificationSchema);
export default Notification;

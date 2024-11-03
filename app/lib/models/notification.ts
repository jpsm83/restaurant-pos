import { Schema, model, models } from "mongoose";
import { notificationTypes } from "../enums.js";

const notificationSchema = new Schema(
  {
    // required fields
    notificationType: { type: String, required: true, enum: notificationTypes }, // Type of notification "warning", "emergency", "info"
    message: { type: String, required: true }, // notification message
    employeesRecipientsIds: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "Employee",
        },
      ],
      default: undefined,
    }, // Reference to the employee receiving the notification
    customersRecipientsIds: {
      type: [
        {
          type: [Schema.Types.ObjectId],
          ref: "Customer",
        },
      ],
      default: undefined,
    }, // Reference to the customer receiving the notification
    senderId: { type: Schema.Types.ObjectId, ref: "Employee" }, // Reference to the employee who created the notification, only used on messages
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    }, // Reference to the business where the notification was created
  },
  {
    timestamps: true,
  }
);

const Notification =
  models.Notification || model("Notification", notificationSchema);
export default Notification;

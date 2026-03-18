import { Schema, model } from "mongoose";
import { notificationEnums } from "../enums.js";

const notificationSchema = new Schema(
  {
    notificationType: {
      type: String,
      required: [true, "NotificationType is required!"],
      enum: notificationEnums,
    },
    message: { type: String, required: [true, "Message is required!"] },
    employeesRecipientsIds: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "Employee",
          index: true,
        },
      ],
      default: undefined,
    },
    customersRecipientsIds: {
      type: [
        {
          type: [Schema.Types.ObjectId],
          ref: "Customer",
          index: true,
        },
      ],
      default: undefined,
    },
    senderId: { type: Schema.Types.ObjectId, ref: "Employee" },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true,
    },
  },
  {
    timestamps: true,
    trim: true,
  }
);

const Notification = model("Notification", notificationSchema);
export default Notification;

import mongoose, { Schema, model } from "mongoose";
import { personalDetailsSchema } from "./personalDetails.js";

const userSchema = new Schema(
  {
    personalDetails: {
      type: personalDetailsSchema,
      required: [true, "Personal details are required!"],
    },
    employeeDetails: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      default: undefined,
      index: true,
    },
    selfOrders: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "Order",
          index: true,
        },
      ],
      default: undefined,
    },
    notifications: {
      type: [
        {
          notificationId: {
            type: Schema.Types.ObjectId,
            ref: "Notification",
            index: true,
          },
          readFlag: { type: Boolean, default: false },
          deletedFlag: { type: Boolean, default: false },
        },
      ],
      default: undefined,
    },
  },
  {
    timestamps: true,
    trim: true,
  }
);

const User = model("User", userSchema);
export default User;


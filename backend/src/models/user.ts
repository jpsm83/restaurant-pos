import { Schema, model, models } from "mongoose";
import { personalDetailsSchema } from "./personalDetails.ts";

const notificationEntrySchema = new Schema(
  {
    notificationId: {
      type: Schema.Types.ObjectId,
      ref: "Notification",
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
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
  },
  {
    timestamps: true,
    trim: true,
  },
);

const User = models.User || model("User", userSchema);
export default User;

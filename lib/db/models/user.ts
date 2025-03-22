import { Schema, model, models } from "mongoose";
import { personalDetailsSchema } from "./personalDetails";

const userSchema = new Schema(
  {
    // required fields
    personalDetails: {
      type: personalDetailsSchema,
      required: [true, "Personal details are required!"],
    }, // personal details of the user

    // we distinguish between user-client or user-employee by checking if the employeeDetails exists, if so, check if "onDuty" is true"
    // optional fields
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
    notifications: {
      type: [
        {
          notificationId: {
            type: Schema.Types.ObjectId,
            ref: "Notification",
            index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
          },
          readFlag: { type: Boolean, default: false },
          deletedFlag: { type: Boolean, default: false },
        },
      ],
      default: undefined,
    }, // notifications received by the user
  },
  {
    timestamps: true,
    trim: true,
  }
);

const User = models.User || model("User", userSchema);
export default User;

import { Schema, model, models } from "mongoose";
import { personalDetailsSchema } from "./personalDetails";

const customerSchema = new Schema(
  {
    // required fields
    personalDetails: {
      type: personalDetailsSchema,
      required: [true, "Personal details is required!"],
    }, // personal details of the customer

    // optional fields
    selfOrders: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "Order",
          index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
        },
      ],
      default: undefined,
    }, // self orders made by the customer
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
    }, // if the customer wants to receive notifications
  },
  { timestamps: true }
);

const Customer = models.Customer || model("Customer", customerSchema);
export default Customer;

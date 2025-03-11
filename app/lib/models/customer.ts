import { Schema, model, models } from "mongoose";
import { personalDetailsSchema } from "./personalDetails";

const customerSchema = new Schema(
  {
    // required fields
    personalDetails: { type: personalDetailsSchema, required: true }, // personal details of the customer

    // optional fields
    selfOrders: [
      {
        type: Schema.Types.ObjectId,
        ref: "Order",
      },
    ],
  }, // self orders made by the customer
  { timestamps: true }
);

const Customer = models.Customer || model("Customer", customerSchema);
export default Customer;

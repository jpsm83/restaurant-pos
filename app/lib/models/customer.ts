import { Schema, model, models } from "mongoose";
import { addressSchema } from "./address";
import { idTypes } from "../enums.js";
import { personalDetailsSchema } from "./personalDetails";

const customerOrdersSchema = new Schema({
  orders: [
    {
      ordersId: {
        type: Schema.Types.ObjectId,
        ref: "Order",
        required: true,
      },
    },
  ], // orders made by the customer
  saleDate: { type: Date, required: true }, // date of the sale
  paymentToken: { type: String, required: true }, // token from payment gateway
  paymentMethodId: { type: String, required: true }, // payment method ID from payment gateway
});

const customerSchema = new Schema(
  {
    // required fields
    customerName: { type: String, required: true, unique: true }, // username for the customer
    email: { type: String, required: true, unique: true }, // email
    password: { type: String, required: true }, // password for the customer
    idType: {
      type: String,
      enum: idTypes,
    }, // type of ID used by the customer
    idNumber: { type: String }, // ID number of the customer
    personalDetails: { type: personalDetailsSchema, required: true }, // personal details of the customer
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    }, // business where the customer works

    // optional fields
    deviceToken: { type: String }, // token for push notifications with Firebase Cloud Messaging
    address: addressSchema, // address of the customer
    imageUrl: { type: String }, // photo of the customer
    // *** IMPORTANTE ***
    // customer might input the contract hours per week as a whole hour number on the front of the application and them it will be converted to milliseconds
    customerOrders: [customerOrdersSchema], // orders made by the customer
    notifications: {
      type: [
        {
          notificationId: {
            type: Schema.Types.ObjectId,
            ref: "Notification",
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

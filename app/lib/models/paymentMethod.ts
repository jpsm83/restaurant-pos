import { Schema } from "mongoose";

import { paymentMethods } from "../enums.js";

// example of a payment method object
// paymentMethod = [
//   {
//     paymentMethodType: "Cash",
//     methodBranch: "Cash",
//     methodSalesTotal: 100,
//   },
//   {
//     paymentMethodType: "Card",
//     methodBranch: "Visa",
//     methodSalesTotal: 150,
//   },
//   {
//     paymentMethodType: "Crypto",
//     methodBranch: "Bitcoin",
//     methodSalesTotal: 200,
//   },
//   {
//     paymentMethodType: "Other",
//     methodBranch: "Voucher",
//     methodSalesTotal: 50,
//   },
// ];

// Define the generic payment method schema
export const paymentMethod = new Schema({
  paymentMethodType: {
    type: String,
    required: true,
    enum: paymentMethods, // Add more types as needed
  },
  methodBranch: {
    type: String,
    required: true,
  }, // Branch/type of the payment method (e.g., card branch, crypto type, etc.)
  methodSalesTotal: {
    type: Number,
    required: true,
  }, // Sum of sales for this payment method
});

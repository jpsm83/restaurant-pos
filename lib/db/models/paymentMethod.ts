import { Schema } from "mongoose";
import { paymentMethodsEnums } from "@/lib/enums";

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
export const paymentMethod = new Schema(
  {
    paymentMethodType: {
      type: String,
      required: [true, "Payment method type is required!"],
      enum: paymentMethodsEnums, // Add more types as needed
    },
    methodBranch: {
      type: String,
      required: [true, "Method branch is required!"],
    }, // Branch/type of the payment method (e.g., card branch, crypto type, etc.)
    methodSalesTotal: {
      type: Number,
      required: [true, "Method sales total is required!"],
    }, // Sum of sales for this payment method
  },
  {
    timestamps: true,
    trim: true,
  }
);

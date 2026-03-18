import { Schema } from "mongoose";
import {
  creditCardEnums,
  cryptoEnums,
  otherPaymentEnums,
  paymentMethodsEnums,
} from "../enums.js";

export const paymentMethod = new Schema(
  {
    paymentMethodType: { type: String, enum: paymentMethodsEnums, required: true },
    methodBranch: {
      type: String,
      enum: [...creditCardEnums, ...cryptoEnums, ...otherPaymentEnums],
      default: undefined,
    },
    methodSalesTotal: { type: Number, required: true },
  },
  { _id: false }
);


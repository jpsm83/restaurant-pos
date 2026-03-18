import mongoose, { Schema, model } from "mongoose";
import { allergensEnums, billingStatusEnums, orderStatusEnums } from "../enums.js";
import { paymentMethod } from "./paymentMethod.js";

const orderSchema = new Schema(
  {
    dailyReferenceNumber: {
      type: Number,
      required: [true, "Daily reference number is required!"],
    },
    billingStatus: {
      type: String,
      enum: billingStatusEnums,
      default: "Open",
    },
    orderStatus: {
      type: String,
      enum: orderStatusEnums,
      default: "Sent",
    },
    orderGrossPrice: { type: Number, required: [true, "Order gross price is required!"] },
    orderNetPrice: { type: Number, required: [true, "Order net price is required!"] },
    orderCostPrice: { type: Number, required: [true, "Order cost price is required!"] },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    createdAsRole: { type: String, enum: ["employee", "customer"] },
    salesInstanceId: {
      type: Schema.Types.ObjectId,
      ref: "SalesInstance",
      required: [true, "Sales instance id is required!"],
      index: true,
    },
    businessGoodId: {
      type: Schema.Types.ObjectId,
      ref: "BusinessGood",
      required: [true, "Business good id is required!"],
      index: true,
    },
    addOns: { type: [Schema.Types.ObjectId], ref: "BusinessGood", default: undefined },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true,
    },
    orderTips: { type: Number },
    paymentMethod: { type: [paymentMethod], default: undefined },
    allergens: { type: [String], enum: allergensEnums, default: undefined },
    promotionApplyed: { type: String },
    discountPercentage: { type: Number },
    comments: { type: String },
  },
  { timestamps: true, trim: true }
);

const Order = model("Order", orderSchema);
export default Order;


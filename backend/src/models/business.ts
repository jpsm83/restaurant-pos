import mongoose, { Schema, model } from "mongoose";
import { addressSchema } from "./address.js";
import { subscriptionEnums } from "../enums.js";

const metricsSchema = new Schema({
  foodCostPercentage: { type: Number, default: 30 },
  beverageCostPercentage: { type: Number, default: 20 },
  laborCostPercentage: { type: Number, default: 30 },
  fixedCostPercentage: { type: Number, default: 20 },
  supplierGoodWastePercentage: {
    veryLowBudgetImpact: { type: Number, default: 9 },
    lowBudgetImpact: { type: Number, default: 7 },
    mediumBudgetImpact: { type: Number, default: 5 },
    hightBudgetImpact: { type: Number, default: 3 },
    veryHightBudgetImpact: { type: Number, default: 1 },
  },
});

const businessOpeningHourSchema = new Schema({
  dayOfWeek: { type: Number, min: 0, max: 6, required: true },
  openTime: { type: String, required: true },
  closeTime: { type: String, required: true },
});

const deliveryWindowSchema = new Schema({
  openTime: { type: String, required: true },
  closeTime: { type: String, required: true },
});

const deliveryOpeningWindowSchema = new Schema({
  dayOfWeek: { type: Number, min: 0, max: 6, required: true },
  windows: { type: [deliveryWindowSchema], default: [] },
});

const reportingConfigSchema = new Schema(
  {
    weeklyReportStartDay: {
      type: Number,
      min: 0,
      max: 6,
      default: 1,
    },
  },
  { _id: false }
);

const businessSchema = new Schema(
  {
    tradeName: { type: String, required: [true, "Trade name is required!"] },
    legalName: { type: String, required: [true, "Legal name is required!"] },
    imageUrl: { type: String },
    email: { type: String, required: [true, "Email is required!"] },
    password: { type: String, required: [true, "Password is required!"] },
    phoneNumber: { type: String, required: [true, "Phone number is required!"] },
    taxNumber: { type: String, required: [true, "Tax number is required!"], unique: true },
    currencyTrade: { type: String, required: [true, "Currency trade is required!"] },
    subscription: { type: String, enum: subscriptionEnums, default: "Free" },
    address: { type: addressSchema, required: [true, "Address is required!"] },
    metrics: { type: metricsSchema },

    contactPerson: { type: String },

    cuisineType: { type: String },
    categories: { type: [String], default: undefined },
    averageRating: { type: Number, default: undefined },
    ratingCount: { type: Number, default: undefined },
    acceptsDelivery: { type: Boolean, default: false },
    deliveryRadius: { type: Number },
    minOrder: { type: Number },
    businessOpeningHours: { type: [businessOpeningHourSchema], default: undefined },
    deliveryOpeningWindows: { type: [deliveryOpeningWindowSchema], default: undefined },
    reportingConfig: { type: reportingConfigSchema, default: undefined },
  },
  { timestamps: true }
);

const Business = model("Business", businessSchema);
export default Business;


import { Schema, model, models } from "mongoose";
import { addressSchema } from "./address.ts";
import { subscriptionEnums } from "../../../lib/enums.ts";

const metricsSchema = new Schema({
  foodCostPercentage: { type: Number, default: 30 }, // Food cost percentage acceptable - 28-35% of sales average
  beverageCostPercentage: { type: Number, default: 20 }, // Beverage cost percentage acceptable - 18-24% of sales average
  laborCostPercentage: { type: Number, default: 30 }, // Labor cost percentage acceptable - 28-35% of sales average
  fixedCostPercentage: { type: Number, default: 20 }, // Fixed cost percentage acceptable - 18-24% of sales average
  // the sun of the cost percentage above should be 100%
  supplierGoodWastePercentage: {
    veryLowBudgetImpact: { type: Number, default: 9 }, // Food waste percentage acceptable - 8-12% of sales average
    lowBudgetImpact: { type: Number, default: 7 }, // Food waste percentage acceptable - 6-10% of sales average
    mediumBudgetImpact: { type: Number, default: 5 }, // Food waste percentage acceptable - 4-8% of sales average
    hightBudgetImpact: { type: Number, default: 3 }, // Food waste percentage acceptable - 2-5% of sales average
    veryHightBudgetImpact: { type: Number, default: 1 }, // Food waste percentage acceptable - 0-2% of sales average
  }, // Food waste percentage acceptable - 3-7% of sales average
});

const businessOpeningHourSchema = new Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    openTime: { type: String, required: true },
    closeTime: { type: String, required: true },
  }
);

const deliveryWindowSchema = new Schema(
  {
    openTime: { type: String, required: true },
    closeTime: { type: String, required: true },
  }
);

const deliveryOpeningWindowSchema = new Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    windows: { type: [deliveryWindowSchema], default: [] },
  }
);

const reportingConfigSchema = new Schema(
  {
    weeklyReportStartDay: {
      type: Number,
      min: 0,
      max: 6,
      default: 1,
    }, // 0 = Sunday, 1 = Monday (default), etc.; used for weeklyBusinessReport
  },
  { _id: false }
);

const businessSchema = new Schema(
  {
    // required fields
    tradeName: { type: String, required: [true, "Trade name is required!"] }, // Company Name for the public
    legalName: { type: String, required: [true, "Legal name is required!"] }, // Legal Name of the company, not unique because could happens of same name bussines in different countries
    imageUrl: { type: String }, // Logo of the company as url link to cloudinary
    email: { type: String, required: [true, "Email is required!"] }, // Email of the company, not unique because could happens of one office managing multiple companies
    password: {
      type: String,
      required: [true, "Password is required!"],
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required!"],
    }, // Phone number of the company
    taxNumber: {
      type: String,
      required: [true, "Tax number is required!"],
      unique: true,
    }, // Tax number of the company
    currencyTrade: {
      type: String,
      required: [true, "Currency trade is required!"],
    }, // currency of the price
    subscription: {
      type: String,
      enum: subscriptionEnums,
      default: "Free",
    }, // Subscription plan for the company
    address: { type: addressSchema, required: [true, "Address is required!"] }, // Address of the company
    metrics: { type: metricsSchema }, // Metrics of the company

    // optional fields
    contactPerson: { type: String }, // Contact person of the company

    // discovery and delivery (optional)
    cuisineType: { type: String }, // e.g. Italian, Japanese
    categories: { type: [String], default: undefined }, // e.g. ["pizza", "pasta", "burgers"] for filter
    averageRating: { type: Number, default: undefined }, // 0–5, cached from Rating documents
    ratingCount: { type: Number, default: undefined }, // count of ratings
    acceptsDelivery: { type: Boolean, default: false },
    deliveryRadius: { type: Number }, // e.g. km; unit documented in API
    minOrder: { type: Number }, // minimum order amount for delivery
    businessOpeningHours: {
      type: [businessOpeningHourSchema],
      default: undefined,
    }, // simple weekly opening hours by dayOfWeek and HH:MM range
    deliveryOpeningWindows: {
      type: [deliveryOpeningWindowSchema],
      default: undefined,
    }, // weekly delivery windows; each has dayOfWeek and windows with HH:MM ranges
    reportingConfig: {
      type: reportingConfigSchema,
      default: undefined,
    }, // optional reporting configuration (e.g. weekly report start day)
  },
  {
    timestamps: true,
  }
);

const Business = models.Business || model("Business", businessSchema);
export default Business;

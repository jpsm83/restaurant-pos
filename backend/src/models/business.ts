import mongoose, { Schema, model } from "mongoose";
import { draftAddressSchema } from "./address.ts";
import * as enums from "restaurant-pos-packages/enums";
import { applyActiveOnlySoftDelete, softDeleteSchemaFields } from "./softDelete.ts";

const { subscriptionEnums } = enums;

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
    // Minimum onboarding set: a draft venue needs only these two fields.
    tradeName: { type: String, required: [true, "Trade name is required!"] }, // Company Name for the public
    imageUrl: { type: String }, // Logo of the company as url link to cloudinary
    // Optional venue profile fields; tax identity lives on the owning Company.
    legalName: { type: String }, // Legacy venue legal name, retained for existing rows
    email: { type: String }, // Venue contact email, not unique because one office may manage multiple companies
    /** Whether the venue contact email has been verified. Not a sign-in credential. */
    emailVerified: {
      type: Boolean,
      default: false,
    },
    phoneNumber: { type: String }, // Phone number of the company
    taxNumber: { type: String }, // Legacy venue tax number, retained for existing rows
    currencyTrade: {
      type: String,
      required: [true, "Currency trade is required!"],
    }, // currency of the price
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: [true, "Company id is required!"],
      index: true,
    }, // owning tax entity; the path from this Business to its Owner
    subscription: {
      type: String,
      enum: subscriptionEnums,
      default: "Free",
    }, // Subscription plan for the company
    timezone: { type: String }, // Authoritative IANA zone (e.g. America/Bogota); legacy businesses may have none
    address: { type: draftAddressSchema }, // Address of the company; country only while a draft
    metrics: { type: metricsSchema }, // Metrics of the company

    // optional fields
    contactPerson: { type: String }, // Contact person of the company

    // discovery and delivery (optional)
    cuisineType: { type: [String], default: undefined }, // discovery cuisines (enum-backed on API)
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
    ...softDeleteSchemaFields,
  },
  {
    timestamps: true,
  }
);

businessSchema.index(
  { taxNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { deleted: false, taxNumber: { $type: "string" } },
  },
);

applyActiveOnlySoftDelete(businessSchema);

const Business = mongoose.models.Business || model("Business", businessSchema);
export default Business;

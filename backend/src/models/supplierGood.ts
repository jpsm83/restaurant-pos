import mongoose, { Schema, model } from "mongoose";
import {
  allergensEnums,
  budgetImpactEnums,
  inventoryScheduleEnums,
  mainCategoriesEnums,
  measurementUnitEnums,
  purchaseUnitEnums,
} from "../enums.js";

const supplierGoodSchema = new Schema(
  {
    name: { type: String, required: [true, "Name is required!"] },
    keyword: { type: String, required: [true, "keyword is required!"] },
    mainCategory: {
      type: String,
      enum: mainCategoriesEnums,
      required: [true, "Main category is required!"],
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: [true, "Supplier id is required!"],
      index: true,
    },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true,
    },

    currentlyInUse: { type: Boolean, default: true },
    subCategory: { type: String },
    description: { type: String },
    allergens: { type: [String], enum: allergensEnums, default: undefined },
    budgetImpact: { type: String, enum: budgetImpactEnums },
    imagesUrl: { type: [String], default: undefined },
    inventorySchedule: { type: String, enum: inventoryScheduleEnums },
    minimumQuantityRequired: { type: Number },
    parLevel: { type: Number },
    purchaseUnit: { type: String, enum: purchaseUnitEnums },
    measurementUnit: { type: String, enum: measurementUnitEnums },
    quantityInMeasurementUnit: { type: Number },
    totalPurchasePrice: { type: Number },
    pricePerMeasurementUnit: { type: Number },
  },
  { timestamps: true, trim: true }
);

const SupplierGood = model("SupplierGood", supplierGoodSchema);
export default SupplierGood;


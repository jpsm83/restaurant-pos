import mongoose, { Schema, model } from "mongoose";
import { allergensEnums, mainCategoriesEnums, measurementUnitEnums } from "../enums.js";

const businessGoodSchema = new Schema(
  {
    name: { type: String, required: [true, "Name is required!"] },
    keyword: { type: String, required: [true, "Keyword is required!"] },
    mainCategory: {
      type: String,
      enum: mainCategoriesEnums,
      required: [true, "Main category is required!"],
    },
    subCategory: { type: String },
    onMenu: { type: Boolean, default: true },
    available: { type: Boolean, default: true },
    sellingPrice: { type: Number, required: [true, "Selling price is required!"] },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true,
    },

    ingredients: {
      type: [
        {
          supplierGoodId: {
            type: Schema.Types.ObjectId,
            ref: "SupplierGood",
            required: [true, "Supplier good id is required!"],
            index: true,
          },
          measurementUnit: {
            type: String,
            enum: measurementUnitEnums,
            required: [true, "Measurement unit is required!"],
          },
          requiredQuantity: { type: Number, required: [true, "Required quantity is required!"] },
          costOfRequiredQuantity: { type: Number },
        },
      ],
      default: undefined,
    },
    setMenuIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "BusinessGood", index: true }],
      default: undefined,
    },

    costPrice: { type: Number },
    grossProfitMarginDesired: { type: Number },
    suggestedSellingPrice: { type: Number },
    description: { type: String },
    allergens: { type: [String], enum: allergensEnums, default: undefined },
    imagesUrl: { type: [String] },
    deliveryTime: { type: Number },
  },
  { timestamps: true, trim: true }
);

const BusinessGood = model("BusinessGood", businessGoodSchema);
export default BusinessGood;


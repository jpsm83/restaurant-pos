import mongoose, { Schema, model } from "mongoose";
import { weekDaysEnums } from "../enums.js";

const promotionSchema = new Schema(
  {
    promotionName: { type: String, required: [true, "Promotion is required!"] },
    promotionPeriod: {
      type: {
        start: { type: Date, required: [true, "Promotion start period is required!"] },
        end: { type: Date, required: [true, "Promotion end period is required!"] },
      },
      required: [true, "Promotion period is required!"],
    },
    weekDays: {
      type: [String],
      enum: weekDaysEnums,
      required: [true, "Week days are required!"],
    },
    activePromotion: { type: Boolean, default: true },
    promotionType: {
      type: {
        fixedPrice: { type: Number },
        discountPercent: { type: Number },
        twoForOne: { type: Boolean },
        threeForTwo: { type: Boolean },
        secondHalfPrice: { type: Boolean },
        fullComplimentary: { type: Boolean },
      },
      required: [true, "Promotion type is required!"],
    },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true,
    },
    businessGoodsToApplyIds: {
      type: [Schema.Types.ObjectId],
      ref: "BusinessGood",
      default: undefined,
      index: true,
    },
    description: { type: String },
  },
  { timestamps: true, trim: true }
);

const Promotion = model("Promotion", promotionSchema);
export default Promotion;


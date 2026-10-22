import mongoose, { Schema, model } from "mongoose";
import { applyActiveOnlySoftDelete, softDeleteSchemaFields } from "./softDelete.ts";

const ratingSchema = new Schema(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User id is required!"],
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: undefined,
    },
    score: {
      type: Number,
      required: [true, "Score is required!"],
      min: [0, "Score must be at least 0"],
      max: [5, "Score must be at most 5"],
    },
    comment: { type: String },
    ...softDeleteSchemaFields,
  },
  { timestamps: true }
);

ratingSchema.index({ businessId: 1, createdAt: -1 });

applyActiveOnlySoftDelete(ratingSchema);

const Rating = mongoose.models.Rating || model("Rating", ratingSchema);
export default Rating;

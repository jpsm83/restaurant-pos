import mongoose, { Schema, model } from "mongoose";
import * as enums from "restaurant-pos-packages/enums";
import { applyActiveOnlySoftDelete, softDeleteSchemaFields } from "./softDelete.ts";

const { subscriptionEnums } = enums;

const ownerSchema = new Schema(
  {
    // required fields
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User id is required!"],
    }, // the person that owns this portfolio
    country: {
      type: String,
      required: [true, "Country is required!"],
    }, // the one country shared by every Company and Business in this portfolio
    subscription: {
      type: String,
      enum: subscriptionEnums,
      default: "Free",
    }, // subscription pointer for the portfolio; covers every owned Business
    ...softDeleteSchemaFields,
  },
  {
    timestamps: true,
    trim: true,
  }
);

// Exactly one active Owner per User; a soft-deleted Owner may be replaced.
ownerSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { deleted: false } },
);

applyActiveOnlySoftDelete(ownerSchema);

const Owner = mongoose.models.Owner || model("Owner", ownerSchema);
export default Owner;

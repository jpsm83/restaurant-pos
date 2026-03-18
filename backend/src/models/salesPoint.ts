import mongoose, { Schema, model } from "mongoose";

const SalesPointSchema = new Schema(
  {
    salesPointName: { type: String, required: [true, "Sales point name is required!"] },
    salesPointType: { type: String },
    selfOrdering: { type: Boolean, default: false },
    qrCode: { type: String },
    qrEnabled: { type: Boolean, default: true },
    qrLastScanned: { type: Date },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true,
    },
  },
  { timestamps: true, trim: true }
);

const SalesPoint = model("SalesPoint", SalesPointSchema);
export default SalesPoint;


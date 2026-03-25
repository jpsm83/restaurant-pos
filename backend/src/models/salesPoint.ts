import mongoose, { Schema, model } from "mongoose";

const SalesPointSchema = new Schema(
  {
    salesPointName: {
      type: String,
      required: [true, "Sales point name is required!"],
    }, // name of the location sale reference - ex: 101
    salesPointType: { type: String }, // table, room, bar, seat, delivery, etc. "delivery" = virtual sales point for delivery orders (no physical table/QR)
    selfOrdering: { type: Boolean, default: false }, // manager toggles customer QR self-order for this location; server gates self-order endpoints on this flag only
    qrCode: { type: String }, // Cloudinary URL (or placeholder) for the table QR; generated on create for non-delivery points
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // business that owns the printer
  },
  {
    timestamps: true,
    trim: true,
  }
);

const SalesPoint =
  mongoose.models.SalesPoint || model("SalesPoint", SalesPointSchema);
export default SalesPoint;

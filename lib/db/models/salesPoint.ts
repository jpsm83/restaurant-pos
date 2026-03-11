import { Schema, model, models } from "mongoose";

const SalesPointSchema = new Schema(
  {
    salesPointName: {
      type: String,
      required: [true, "Sales point name is required!"],
    }, // name of the location sale reference - ex: 101
    salesPointType: { type: String }, // table, room, bar, seat, delivery, etc. "delivery" = virtual sales point for delivery orders (no physical table/QR)
    selfOrdering: { type: Boolean, default: false }, // manager decision if location can order by itself using QR code
    qrCode: { type: String }, // auto created QR code for the location
    qrEnabled: { type: Boolean, default: true }, // QR code enabled or disabled - when QR is scanned, it will be disabled and a timer on the frontend will set, if the timer expires, the frontend page will close and the QR code will be enabled again - only if selfOrdering is true
    qrLastScanned: { type: Date }, // last time the QR code was scanned
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

const SalesPoint = models.SalesPoint || model("SalesPoint", SalesPointSchema);
export default SalesPoint;

import mongoose, { Schema, model } from "mongoose";
import { reservationStatusEnums } from "../enums.js";

const reservationSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdByRole: { type: String, enum: ["customer", "employee"], required: true },
    guestCount: { type: Number, required: true },
    reservationStart: { type: Date, required: true, index: true },

    reservationEnd: { type: Date, index: true },
    description: { type: String },
    status: { type: String, enum: reservationStatusEnums, default: "Pending", index: true },
    employeeResponsableByUserId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    salesPointId: { type: Schema.Types.ObjectId, ref: "SalesPoint", index: true },
    salesInstanceId: { type: Schema.Types.ObjectId, ref: "SalesInstance", index: true },
  },
  { timestamps: true, trim: true }
);

reservationSchema.index({ businessId: 1, reservationStart: 1 });
reservationSchema.index({ businessId: 1, status: 1, reservationStart: 1 });

const Reservation = model("Reservation", reservationSchema);
export default Reservation;


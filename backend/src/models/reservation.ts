import { Schema, model, models } from "mongoose";
import { reservationStatusEnums } from "../../../lib/enums.ts";

const reservationSchema = new Schema(
  {
    // required fields
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true,
    },
    createdByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Created by user id is required!"],
      index: true,
    },
    createdByRole: {
      type: String,
      enum: ["customer", "employee"],
      required: [true, "Created by role is required!"],
    },
    guestCount: {
      type: Number,
      required: [true, "Guest count is required!"],
    },
    reservationStart: {
      type: Date,
      required: [true, "Reservation start is required!"],
      index: true,
    },

    // optional fields
    reservationEnd: {
      type: Date,
      index: true,
    }, // may be set/adjusted by staff; used for conflict checks
    description: {
      type: String,
    }, // e.g. birthday, business lunch, friends meeting
    status: {
      type: String,
      enum: reservationStatusEnums,
      default: "Pending",
      index: true,
    },
    employeeResponsableByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    }, // staff user that accepted/rejected/handles the reservation
    salesPointId: {
      type: Schema.Types.ObjectId,
      ref: "SalesPoint",
      index: true,
    }, // table assigned by staff (optional)
    salesInstanceId: {
      type: Schema.Types.ObjectId,
      ref: "SalesInstance",
      index: true,
    }, // linked when reservation turns into a consuming session
  },
  {
    timestamps: true,
    trim: true,
  }
);

reservationSchema.index({ businessId: 1, reservationStart: 1 });
reservationSchema.index({ businessId: 1, status: 1, reservationStart: 1 });

const Reservation =
  models.Reservation || model("Reservation", reservationSchema);
export default Reservation;

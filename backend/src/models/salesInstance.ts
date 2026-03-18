import mongoose, { Schema, model } from "mongoose";
import { salesInstanceStatusEnums } from "../enums.js";

const salesInstanceSchema = new Schema(
  {
    dailyReferenceNumber: {
      type: Number,
      required: [true, "Daily reference number is required!"],
    },
    salesPointId: {
      type: Schema.Types.ObjectId,
      ref: "SalesPoint",
      required: [true, "Sales point id is required!"],
      index: true,
    },
    guests: { type: Number, required: [true, "Guest is required!"] },
    salesInstanceStatus: {
      type: String,
      enum: salesInstanceStatusEnums,
      default: "Occupied",
    },
    openedByUserId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    openedAsRole: { type: String, enum: ["employee", "customer"] },
    responsibleByUserId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    closedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true,
    },
    reservationId: { type: Schema.Types.ObjectId, ref: "Reservation", index: true },

    clientName: { type: String },
    salesGroup: {
      type: [
        {
          orderCode: { type: String, required: [true, "Order code is required!"] },
          ordersIds: {
            type: [Schema.Types.ObjectId],
            ref: "Order",
            default: undefined,
            index: true,
          },
          createdAt: { type: Date },
        },
      ],
      default: undefined,
    },
    closedAt: { type: Date },
  },
  { timestamps: true, trim: true }
);

const SalesInstance = model("SalesInstance", salesInstanceSchema);
export default SalesInstance;


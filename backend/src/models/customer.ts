import mongoose, { Schema, model } from "mongoose";

const notificationEntrySchema = new Schema(
  {
    notificationId: { type: Schema.Types.ObjectId, ref: "Notification", required: true },
    readFlag: { type: Boolean, default: false },
    deletedFlag: { type: Boolean, default: false },
  },
  { _id: false }
);

const customerSchema = new Schema(
  {
    customerName: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    notifications: { type: [notificationEntrySchema], default: undefined },
  },
  { timestamps: true, trim: true }
);

const Customer = model("Customer", customerSchema);
export default Customer;

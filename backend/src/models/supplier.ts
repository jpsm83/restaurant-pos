import { Schema, model } from "mongoose";
import { addressSchema } from "./address.js";

const supplierSchema = new Schema(
  {
    tradeName: { type: String, required: [true, "Trade name is required!"] },
    legalName: { type: String, required: [true, "Legal name is required!"] },
    email: {
      type: String,
      required: [true, "Email is required!"],
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required!"],
    },
    taxNumber: {
      type: String,
      required: [true, "Tax number is required!"],
      unique: true,
    },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true,
    },
    address: { type: addressSchema, required: [true, "Address is required!"] },
    currentlyInUse: { type: Boolean, default: true },
    imageUrl: { type: String },
    contactPerson: { type: String },
  },
  {
    timestamps: true,
    trim: true,
  }
);

const Supplier = model("Supplier", supplierSchema);
export default Supplier;

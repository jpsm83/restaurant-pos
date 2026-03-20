import { Schema, model, models } from "mongoose";
import { addressSchema } from "./address.ts";

const supplierSchema = new Schema(
  {
    // required fields
    tradeName: { type: String, required: [true, "Trade name is required!"] }, // Suplier company Name for the public
    legalName: { type: String, required: [true, "Legal name is required!"] }, // Legal Name of the suplier company
    email: {
      type: String,
      required: [true, "Email is required!"],
    }, // Email of the suplier
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required!"],
    }, // Phone number of the suplier
    taxNumber: {
      type: String,
      required: [true, "Tax number is required!"],
      unique: true,
    }, // Tax number of the suplier
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // business that is buying from the suplier
    address: { type: addressSchema, required: [true, "Address is required!"] }, // Address of the company
    currentlyInUse: { type: Boolean, default: true }, // currenctly dealing with the suplier

    // optional fields
    imageUrl: { type: String }, // Logo of the suplier company
    contactPerson: { type: String }, // Contact person of the suplier
  },
  {
    timestamps: true,
    trim: true,
  }
);

const Supplier = models.Supplier || model("Supplier", supplierSchema);
export default Supplier;

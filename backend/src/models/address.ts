import { Schema } from "mongoose";

export const addressSchema = new Schema({
  country: { type: String, required: [true, "Country is required!"] },
  state: { type: String, required: [true, "State is required!"] },
  city: { type: String, required: [true, "City is required!"] },
  street: { type: String, required: [true, "Street is required!"] },
  buildingNumber: { type: String, required: [true, "Building number is required!"] },
  postCode: { type: String, required: [true, "Postcode is required!"] },

  region: { type: String },
  additionalDetails: { type: String },
  coordinates: { type: [Number], default: undefined }, // [longitude, latitude]
});


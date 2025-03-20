import { Schema } from "mongoose";

export const addressSchema = new Schema({
  // required fields
  country: { type: String, required: [true, "Country is required!"] }, // country
  state: { type: String, required: [true, "State is required!"] }, // state
  city: { type: String, required: [true, "City is required!"] }, // city
  street: { type: String, required: [true, "Street is required!"] }, // street
  buildingNumber: {
    type: String,
    required: [true, "Building number is required!"],
  }, // building number
  postCode: { type: String, required: [true, "Postcode is required!"] }, // local post code

  // optional fields
  region: { type: String },
  additionalDetails: { type: String }, // additional details about the location
  coordinates: { type: [Number], default: undefined }, // [longitude, latitude] ex: [40.712776, -74.005974] New York City - it will auto complete after required fields are filled
});

import { Schema } from "mongoose";

export const addressSchema = new Schema({
  // required fields
  country: { type: String, required: true }, // country
  state: { type: String, required: true }, // state
  city: { type: String, required: true }, // city
  street: { type: String, required: true }, // street
  buildingNumber: { type: String, required: true }, // building number
  postCode: { type: String, required: true }, // local post code

  // optional fields
  region: { type: String },
  additionalDetails: { type: String }, // additional details about the location
  coordinates: { type: [Number], default: undefined }, // [longitude, latitude] ex: [40.712776, -74.005974] New York City - it will auto complete after required fields are filled
});

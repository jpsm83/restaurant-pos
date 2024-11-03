import { Schema } from "mongoose";

export const personalDetailsSchema = new Schema({
  // required fields
  firstName: { type: String, required: true }, // first name
  lastName: { type: String, required: true }, // last name
  nationality: { type: String, required: true }, // country of birth
  gender: { type: String, enum: ["Man", "Woman", "Other"], required: true }, // gender
  birthDate: { type: Date, required: true }, // date of birth
  phoneNumber: { type: String, required: true }, // phone number
});
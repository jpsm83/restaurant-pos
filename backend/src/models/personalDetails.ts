import { Schema } from "mongoose";
import { addressSchema } from "./address.ts";
import * as enums from "restaurant-pos-packages/enums";

const { genderEnums } = enums;

export const personalDetailsSchema = new Schema(
  {
    // required fields
    email: {
      type: String,
      required: [true, "Email is required!"],
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Please enter a valid email address!",
      ],
      lowercase: true,
    }, // sign-in email
    /** True once `personalDetails.email` is confirmed through auth email flow. */
    emailVerified: {
      type: Boolean,
      default: false,
    },
    // optional fields
    username: { type: String }, // username for the customer
    password: { type: String }, // absent until a password is set
    address: { type: addressSchema }, // address of the customer
    firstName: { type: String }, // first name
    lastName: { type: String }, // last name
    nationality: { type: String }, // country of birth
    gender: { type: String, enum: genderEnums }, // gender
    birthDate: { type: Date }, // date of birth
    phoneNumber: { type: String }, // phone number
    imageUrl: { type: String }, // photo of the customer
  },
  {
    timestamps: true,
    trim: true,
  }
);

import { Schema } from "mongoose";
import { idEnums } from "../../../lib/enums.ts";
import { addressSchema } from "./address.ts";

export const personalDetailsSchema = new Schema(
  {
    // required fields
    username: { type: String, required: [true, "Username is required!"] }, // username for the customer
    email: {
      type: String,
      required: [true, "Email is required!"],
      unique: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Please enter a valid email address!",
      ],
      lowercase: true,
    }, // email
    password: {
      type: String,
      required: [true, "Password is required!"],
    },
    idType: {
      type: String,
      enum: idEnums,
      required: [true, "Id type is required!"],
    }, // type of ID used by the customer
    idNumber: { type: String, required: [true, "Id number is required!"] }, // ID number of the customer
    address: { type: addressSchema, required: [true, "Address is required!"] }, // address of the customer
    firstName: { type: String, required: [true, "First name is required!"] }, // first name
    lastName: { type: String, required: [true, "Last name is required!"] }, // last name
    // optional fields
    nationality: { type: String, required: true }, // country of birth
    gender: { type: String, enum: ["Man", "Woman", "Other"], required: true }, // gender
    birthDate: { type: Date, required: true }, // date of birth
    phoneNumber: { type: String, required: true }, // phone number
    imageUrl: { type: String }, // photo of the customer
  },
  {
    timestamps: true,
    trim: true,
  }
);

import { Schema } from "mongoose";
import { idEnums } from "../enums.js";
import { addressSchema } from "./address.js";

export const personalDetailsSchema = new Schema(
  {
    username: { type: String, required: [true, "Username is required!"] },
    email: {
      type: String,
      required: [true, "Email is required!"],
      unique: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Please enter a valid email address!",
      ],
      lowercase: true,
    },
    password: { type: String, required: [true, "Password is required!"] },
    idType: {
      type: String,
      enum: idEnums,
      required: [true, "Id type is required!"],
    },
    idNumber: { type: String, required: [true, "Id number is required!"] },
    address: { type: addressSchema, required: [true, "Address is required!"] },
    firstName: { type: String, required: [true, "First name is required!"] },
    lastName: { type: String, required: [true, "Last name is required!"] },

    nationality: { type: String, required: true },
    gender: { type: String, enum: ["Man", "Woman", "Other"], required: true },
    birthDate: { type: Date, required: true },
    phoneNumber: { type: String, required: true },
    imageUrl: { type: String },
  },
  {
    timestamps: true,
    trim: true,
  }
);


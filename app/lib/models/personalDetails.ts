import { Schema } from "mongoose";
import { idTypes } from "../enums";
import { addressSchema } from "./address";

export const personalDetailsSchema = new Schema({
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
    trim: true,
    lowecase: true,
  }, // email
  password: {
    type: String,
    required: [true, "Password is required!"],
    match: [
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      "Password must be 8 characters long and contain lowercase, uppercase, symbol and number!",
    ],
    minLength: 8,
  }, // password for the employee
  idType: {
    type: String,
    enum: idTypes,
    required: [true, "Id type is required!"],
  }, // type of ID used by the customer
  idNumber: { type: String, required: [true, "Id number is required!"] }, // ID number of the customer
  address: { type: addressSchema, required: [true, "Address is required!"] }, // address of the customer
  firstName: { type: String, required: [true, "First name is required!"] }, // first name
  lastName: { type: String, required: [true, "Last name is required!"] }, // last name
  // optional fields
  imageUrl: { type: String }, // photo of the customer
  nationality: { type: String, required: true }, // country of birth
  gender: { type: String, enum: ["Man", "Woman", "Other"], required: true }, // gender
  birthDate: { type: Date, required: true }, // date of birth
  phoneNumber: { type: String, required: true }, // phone number
  deviceToken: { type: String }, // token for push notifications with Firebase Cloud Messaging
  notifications: {
    type: [
      {
        notificationId: {
          type: Schema.Types.ObjectId,
          ref: "Notification",
        },
        readFlag: { type: Boolean, default: false },
        deletedFlag: { type: Boolean, default: false },
      },
    ],
    default: undefined,
  }, // if the customer wants to receive notifications
});

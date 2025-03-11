import { Schema } from "mongoose";
import { idTypes } from "../enums";
import { addressSchema } from "./address";

export const personalDetailsSchema = new Schema({
  // required fields
  username: { type: String, required: true, unique: true }, // username for the customer
  email: { type: String, required: true, unique: true }, // email
  password: { type: String, required: true }, // password for the customer
  idType: {
    type: String,
    enum: idTypes,
  }, // type of ID used by the customer
  idNumber: { type: String }, // ID number of the customer
  address: addressSchema, // address of the customer
  firstName: { type: String, required: true }, // first name
  lastName: { type: String, required: true }, // last name
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

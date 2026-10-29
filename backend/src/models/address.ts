import { Schema } from "mongoose";

/**
 * One address field definition. A full address (suppliers, personal details)
 * requires every location field; a draft venue address requires only the
 * country and can be completed later.
 */
function buildAddressSchema(requireFull: boolean, id = true) {
  const requiredString = (message: string) =>
    requireFull
      ? { type: String, required: [true, message] }
      : { type: String };

  return new Schema(
    {
      // required fields
      country: { type: String, required: [true, "Country is required!"] }, // country
      state: requiredString("State is required!"), // state
      city: requiredString("City is required!"), // city
      street: requiredString("Street is required!"), // street
      buildingNumber: requiredString("Building number is required!"), // building number
      doorNumber: { type: String }, // unit / door / apartment identifier (optional)
      complement: { type: String }, // extra address line (floor, wing, etc.; optional)
      postCode: requiredString("Postcode is required!"), // local post code

      // optional fields
      region: { type: String },
      additionalDetails: { type: String }, // additional details about the location
      coordinates: { type: [Number], default: undefined }, // [longitude, latitude] ex: [40.712776, -74.005974] New York City - it will auto complete after required fields are filled
    },
    { _id: id },
  );
}

/** Full postal address used by entities that require a complete address. */
export const addressSchema = buildAddressSchema(true);

/** Draft venue address: country only; the remaining fields may stay empty. */
export const draftAddressSchema = buildAddressSchema(false, false);

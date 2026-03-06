/**
 * addressValidation — Address shape and required-field validator
 *
 * Ensures address payloads conform to IAddress: only allowed keys are present,
 * and required location fields are non-empty. Used before persisting or
 * sending addresses (e.g. user profile, delivery, venue). Necessary to
 * prevent malformed data and to return clear, user-facing error messages.
 */

import { IAddress } from "@/lib/interface/IAddress";

/**
 * Validates an address object. Returns true if valid, or a string error message.
 */
export const addressValidation = (address: IAddress) => {
  if (typeof address !== "object")
    return "Address must be an object!";

  /** All keys allowed on IAddress; extra keys are rejected. */
  const validKeys = [
    "country",
    "state",
    "city",
    "street",
    "buildingNumber",
    "postCode",
    "region",
    "additionalDetails",
    "coordinates",
  ];

  for (const key of Object.keys(address)) {
    if (!validKeys.includes(key)) {
      return `Invalid key: ${key}`;
    }
  }

  /** Fields that must be present and non-empty for a valid address. */
  const requiredFields = [
    "country",
    "state",
    "city",
    "street",
    "buildingNumber",
    "postCode",
  ];

  for (const key of requiredFields) {
    const value = address[key as keyof IAddress];

    if (!value) {
      return `${key} must have a value!`;
    }
  }

  return true;
};

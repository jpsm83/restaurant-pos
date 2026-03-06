/**
 * personalDetailsValidation — Personal details shape and required-field validator
 *
 * Ensures a personal-details payload has exactly the six IPersonalDetails keys
 * and that each has a non-empty value. Used when updating or creating user
 * profile personal data. Necessary to keep stored PII consistent and to
 * return clear validation errors to the client.
 */

import { IPersonalDetails } from "../interface/IPersonalDetails";

/**
 * Validates personal details. Returns true if valid, or a string error message.
 */
export const personalDetailsValidation = (
  personalDetails: IPersonalDetails
) => {
  if (typeof personalDetails !== "object" || Object.keys(personalDetails).length !== 6)
    return "Personal details must be an object of 6 keys!";

  /** Exact set of keys required for IPersonalDetails; no more, no less. */
  const validKeys = [
    "firstName",
    "lastName",
    "nationality",
    "gender",
    "birthDate",
    "phoneNumber",
  ];

  for (const key of Object.keys(personalDetails)) {
    if (!validKeys.includes(key)) {
      return `Invalid key: ${key}`;
    }
  }

  for (const key of Object.keys(personalDetails)) {
    const value = personalDetails[key as keyof IPersonalDetails];

    if (!value) {
      return `${key} must have a value!`;
    }
  }

  return true;
};

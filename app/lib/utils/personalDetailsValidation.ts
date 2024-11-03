import { IPersonalDetails } from "@/app/lib/interface/IEmployee";

export const personalDetailsValidation = (
  personalDetails: IPersonalDetails
) => {
  // check personalDetails is an object
  if (typeof personalDetails !== "object" || Object.keys(personalDetails).length !== 6)
    return "Personal details must be an object of 6 keys!";

  // required fields
  const validKeys = [
    "firstName",
    "lastName",
    "nationality",
    "gender",
    "birthDate",
    "phoneNumber",
  ];

  // Check for any invalid keys
  for (const key of Object.keys(personalDetails)) {
    if (!validKeys.includes(key)) {
      return `Invalid key: ${key}`;
    }
  }

  // Validate each parameter
  for (const key of Object.keys(personalDetails)) {
    const value = personalDetails[key as keyof IPersonalDetails];

    if (!value) {
      return `${key} must have a value!`;
    }
  }

  return true;
};

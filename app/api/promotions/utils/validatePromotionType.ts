export const validatePromotionType = (promotionType: { [key: string]: any }) => {
  if (!promotionType || typeof promotionType !== "object") {
    return "Promotion type is a required object!";
  }

  const acceptableKeysValues = [
    { name: "fixedPrice", typeValue: "number" },
    { name: "discountPercent", typeValue: "number" },
    { name: "twoForOne", typeValue: "boolean" },
    { name: "threeForTwo", typeValue: "boolean" },
    { name: "secondHalfPrice", typeValue: "boolean" },
    { name: "fullComplimentary", typeValue: "boolean" },
  ];

  const keys = Object.keys(promotionType);

  if (keys.length !== 1) {
    return "Promotion type must have only one key and one value!";
  }

  const key = keys[0];
  const keyValue = promotionType[key];
  const matchingKey = acceptableKeysValues.find(k => k.name === key);

  if (!matchingKey) {
    return "Invalid promotion type key!";
  }

  const isValidType = typeof keyValue === matchingKey.typeValue;

  return isValidType ? true : `Invalid type for ${key}. Expected ${matchingKey.typeValue}, got ${typeof keyValue}.`;
};
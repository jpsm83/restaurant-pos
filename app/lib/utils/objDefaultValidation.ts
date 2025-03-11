const objDefaultValidation = (
  obj: object,
  reqFields: string[],
  nonReqFields: string[]
) => {
  // check obj is an object
  if (typeof obj !== "object" || obj === null) {
    return "Object must be a non-null object!";
  }

  const allFields = new Set([...reqFields, ...nonReqFields]);

  // Check for any invalid keys and validate each parameter
  for (const key of Object.keys(obj)) {
    if (!allFields.has(key)) {
      return `Invalid key: ${key}`;
    }
    if (reqFields.includes(key) && !obj[key]) {
      return `${key} must have a value!`;
    }
  }

  // Check for missing required fields
  for (const key of reqFields) {
    if (!(key in obj)) {
      return `Missing key: ${key}`;
    }
  }

  return true;
};

export default objDefaultValidation;
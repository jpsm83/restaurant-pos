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
    if (key === "password") {
      const regex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!regex.test(obj[key])) {
        return "Password must be at least 8 characters long and contain a lowercase letter, an uppercase letter, a symbol, and a number!";
      }
    }

    if (key === "email") {
      const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!regex.test(obj[key])) {
        return "Please enter a valid email address!";
      }
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

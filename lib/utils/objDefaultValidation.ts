/**
 * objDefaultValidation — Generic object validator with required/optional fields
 *
 * Validates arbitrary objects against a whitelist of required and optional
 * keys, and applies built-in rules for "password" (strength) and "email"
 * (format). Used for signup, profile updates, and other dynamic payloads.
 * Necessary to enforce schema and security (e.g. strong passwords) without
 * duplicating validation logic across endpoints.
 */

const objDefaultValidation = (
  obj: unknown,
  reqFields: string[],
  nonReqFields: string[]
) => {
  if (typeof obj !== "object" || obj === null) {
    return "Object must be a non-null object!";
  }

  const record = obj as Record<string, unknown>;

  /** Only these keys are allowed; anything else is invalid. */
  const allFields = new Set([...reqFields, ...nonReqFields]);

  for (const key of Object.keys(record)) {
    if (!allFields.has(key)) {
      return `Invalid key: ${key}`;
    }
    if (reqFields.includes(key) && !record[key]) {
      return `${key} must have a value!`;
    }
    /** If present, password must meet strength rules (length + lower, upper, digit, symbol). */
    if (key === "password") {
      const regex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      const password = record[key];
      if (typeof password !== "string" || !regex.test(password)) {
        return "Password must be at least 8 characters long and contain a lowercase letter, an uppercase letter, a symbol, and a number!";
      }
    }

    /** If present, email must match a basic email pattern. */
    if (key === "email") {
      const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      const email = record[key];
      if (typeof email !== "string" || !regex.test(email)) {
        return "Please enter a valid email address!";
      }
    }
  }

  /** Every required field must exist on the object (value check done above). */
  for (const key of reqFields) {
    if (!(key in record)) {
      return `Missing key: ${key}`;
    }
  }

  return true;
};

export default objDefaultValidation;

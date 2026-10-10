import { describe, it, expect } from "vitest";
import { z } from "zod";

import {
  coercedBooleanSchema,
  coercedIntSchema,
  coercedNumberSchema,
  emailSchema,
  freeTextString,
  jsonField,
  objectIdSchema,
  sanitizedString,
  trimmedString,
} from "../../../packages/schemas/index.ts";

describe("objectIdSchema", () => {
  it("accepts a 24-character hex id", () => {
    const result = objectIdSchema.safeParse("507f1f77bcf86cd799439011");
    expect(result.success).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    const result = objectIdSchema.safeParse("  507f1f77bcf86cd799439011  ");
    expect(result).toEqual({ success: true, data: "507f1f77bcf86cd799439011" });
  });

  it.each(["", "123", "zzzzzzzzzzzzzzzzzzzzzzzz", "507f1f77bcf86cd79943901"])(
    "rejects %j",
    (value) => {
      expect(objectIdSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("emailSchema", () => {
  it("trims and lowercases", () => {
    expect(emailSchema.parse("  Foo.Bar@Example.COM ")).toBe(
      "foo.bar@example.com",
    );
  });

  it("rejects a malformed email", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });
});

describe("trimmedString", () => {
  it("trims and collapses internal whitespace", () => {
    expect(trimmedString().parse("  a \t  b \n c ")).toBe("a b c");
  });

  it("supports a custom non-empty message", () => {
    const result = trimmedString("Name is required").safeParse("   ");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Name is required");
    }
  });
});

describe("sanitizedString", () => {
  it("strips HTML markup and control characters", () => {
    expect(sanitizedString().parse("<b>Hi</b>\u0000\u0007 there")).toBe(
      "Hi there",
    );
  });
});

describe("freeTextString", () => {
  it("strips HTML but preserves line breaks", () => {
    expect(freeTextString().parse("line one<br>line two\n\n\nline three")).toBe(
      "line oneline two\n\nline three",
    );
  });
});

describe("coerced numbers", () => {
  it("coerces numeric strings", () => {
    expect(coercedNumberSchema.parse("42.5")).toBe(42.5);
    expect(coercedIntSchema.parse("7")).toBe(7);
  });

  it("rejects a non-integer for the int schema", () => {
    expect(coercedIntSchema.safeParse("1.5").success).toBe(false);
  });
});

describe("coercedBooleanSchema", () => {
  it.each([
    ["true", true],
    ["TRUE", true],
    ["1", true],
    ["yes", true],
    ["on", true],
    ["false", false],
    ["0", false],
    ["no", false],
    ["off", false],
  ])("coerces %j to %s", (input, expected) => {
    expect(coercedBooleanSchema.parse(input)).toBe(expected);
  });

  it("passes through real booleans", () => {
    expect(coercedBooleanSchema.parse(true)).toBe(true);
    expect(coercedBooleanSchema.parse(false)).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(coercedBooleanSchema.safeParse("").success).toBe(false);
  });

  it("is absent when the field is not provided", () => {
    const schema = coercedBooleanSchema.optional();
    expect(schema.parse(undefined)).toBeUndefined();
  });
});

describe("jsonField", () => {
  it("parses a JSON string", () => {
    const schema = jsonField(z.object({ city: z.string() }));
    expect(schema.parse('{"city":"Lisbon"}')).toEqual({ city: "Lisbon" });
  });

  it("passes non-string values through", () => {
    const schema = jsonField(z.object({ city: z.string() }));
    expect(schema.parse({ city: "Porto" })).toEqual({ city: "Porto" });
  });

  it("rejects an empty string", () => {
    const schema = jsonField(z.object({ city: z.string() }));
    const result = schema.safeParse("");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Invalid JSON");
    }
  });

  it("reports malformed JSON", () => {
    const schema = jsonField(z.object({ city: z.string() }));
    const result = schema.safeParse("{not json");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Invalid JSON");
    }
  });
});

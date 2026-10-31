import { describe, it, expect } from "vitest";

import {
  markNotificationDeletedBodySchema,
  updateUserBodySchema,
  userIdParamsSchema,
  userNotificationParamsSchema,
} from "restaurant-pos-packages/schemas/user";

const VALID_ID = "507f1f77bcf86cd799439011";
const OTHER_ID = "507f191e810c19729de860ea";

const validAddress = {
  country: "USA",
  state: "CA",
  city: "Los Angeles",
  street: "Main St",
  buildingNumber: "123",
  postCode: "90001",
};

const validUpdate = {
  username: "newuser",
  firstName: "New",
  lastName: "User",
  nationality: "USA",
  gender: "Man",
  birthDate: "1990-01-01",
  phoneNumber: "9876543210",
  address: JSON.stringify(validAddress),
  languagePreference: "es",
};

describe("updateUserBodySchema", () => {
  it("accepts an empty body because every profile field is optional", () => {
    expect(updateUserBodySchema.parse({})).toEqual({});
  });

  it("accepts and normalizes the client profile fields", () => {
    const parsed = updateUserBodySchema.parse(validUpdate);
    expect(parsed.username).toBe("newuser");
    expect(parsed.address).toEqual(validAddress);
    expect(parsed.gender).toBe("Man");
    expect(parsed.birthDate).toEqual(new Date("1990-01-01"));
    expect(parsed.languagePreference).toBe("es");
  });

  it("treats blank fields as explicit clears", () => {
    const parsed = updateUserBodySchema.parse({
      username: "  ",
      firstName: "",
      phoneNumber: "",
      nationality: "",
      gender: "",
      birthDate: "",
      address: "",
      languagePreference: "",
    });
    expect(parsed).toEqual({
      username: null,
      firstName: null,
      phoneNumber: null,
      nationality: null,
      gender: null,
      birthDate: null,
      address: null,
      languagePreference: null,
    });
  });

  it("omits fields that were not sent", () => {
    const parsed = updateUserBodySchema.parse({
      languagePreference: "en",
    });
    expect(parsed).toEqual({ languagePreference: "en" });
  });

  it("parses the JSON-encoded address and rejects incomplete or malformed values", () => {
    expect(
      updateUserBodySchema.safeParse({
        ...validUpdate,
        address: JSON.stringify({ country: "USA" }),
      }).success,
    ).toBe(false);

    expect(
      updateUserBodySchema.safeParse({ ...validUpdate, address: "{not json" })
        .success,
    ).toBe(false);
  });

  it("rejects an invalid gender, birth date and language", () => {
    expect(
      updateUserBodySchema.safeParse({ ...validUpdate, gender: "Unknown" })
        .success,
    ).toBe(false);
    expect(
      updateUserBodySchema.safeParse({ ...validUpdate, birthDate: "not-a-date" })
        .success,
    ).toBe(false);
    expect(
      updateUserBodySchema.safeParse({
        ...validUpdate,
        languagePreference: "fr",
      }).success,
    ).toBe(false);
  });

  it("sanitizes structured fields and strips markup from names", () => {
    const parsed = updateUserBodySchema.parse({
      ...validUpdate,
      username: "  <b>new</b>   user ",
      firstName: "  New  ",
      nationality: "<i>USA</i>",
    });
    expect(parsed.username).toBe("new user");
    expect(parsed.firstName).toBe("New");
    expect(parsed.nationality).toBe("USA");
  });

  it("rejects server-owned, credential and employment fields", () => {
    for (const field of [
      "email",
      "password",
      "idType",
      "idNumber",
      "imageUrl",
      "emailVerified",
      "verificationToken",
      "resetPasswordToken",
      "refreshSessionVersion",
      "privacyAccepted",
      "privacyAcceptedAt",
      "marketingConsent",
      "marketingConsentUpdatedAt",
      "notifications",
    ]) {
      expect(
        updateUserBodySchema.safeParse({ ...validUpdate, [field]: "x" })
          .success,
        field,
      ).toBe(false);
    }
  });

  it("rejects unknown keys", () => {
    expect(
      updateUserBodySchema.safeParse({ ...validUpdate, ratingCount: 5 })
        .success,
    ).toBe(false);
  });
});

describe("user path params and notification bodies", () => {
  it("userIdParamsSchema accepts a valid ObjectId and rejects a malformed one", () => {
    expect(userIdParamsSchema.safeParse({ userId: VALID_ID }).success).toBe(
      true,
    );
    expect(userIdParamsSchema.safeParse({ userId: "invalid-id" }).success).toBe(
      false,
    );
    expect(
      userIdParamsSchema.safeParse({ userId: VALID_ID, extra: "x" }).success,
    ).toBe(false);
  });

  it("markNotificationDeletedBodySchema requires an ObjectId notificationId", () => {
    expect(
      markNotificationDeletedBodySchema.safeParse({ notificationId: VALID_ID })
        .success,
    ).toBe(true);
    expect(
      markNotificationDeletedBodySchema.safeParse({ notificationId: "nope" })
        .success,
    ).toBe(false);
    expect(markNotificationDeletedBodySchema.safeParse({}).success).toBe(false);
  });

  it("userNotificationParamsSchema validates both ids", () => {
    expect(
      userNotificationParamsSchema.safeParse({
        userId: VALID_ID,
        notificationId: OTHER_ID,
      }).success,
    ).toBe(true);
    expect(
      userNotificationParamsSchema.safeParse({
        userId: "nope",
        notificationId: OTHER_ID,
      }).success,
    ).toBe(false);
  });
});

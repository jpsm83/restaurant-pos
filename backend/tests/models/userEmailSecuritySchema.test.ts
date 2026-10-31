/**
 * User auth-email fields persist and are queryable.
 */
import { describe, it, expect } from "vitest";
import User from "../../src/models/user.ts";

const minimalPersonalDetails = {
  email: "schema-test@example.com",
  password: "hashed-placeholder",
  firstName: "Test",
  lastName: "User",
  phoneNumber: "1234567890",
  birthDate: new Date("1990-01-01"),
  gender: "Man" as const,
  nationality: "USA",
  address: {
    country: "USA",
    state: "CA",
    city: "LA",
    street: "Main St",
    buildingNumber: "123",
    postCode: "90001",
  },
  idNumber: "ID-SCHEMA-001",
  idType: "Passport" as const,
  username: "schematest",
};

describe("User email security schema", () => {
  it("keeps the verified flag only on personalDetails and stores verification + reset tokens", async () => {
    expect(User.schema.path("emailVerified")).toBeUndefined();
    expect(User.schema.path("personalDetails.emailVerified")).toBeDefined();

    const expiresReset = new Date(Date.now() + 3_600_000);
    const expiresVerification = new Date(Date.now() + 86_400_000);

    const created = await User.create({
      personalDetails: minimalPersonalDetails,
      verificationToken: "confirm-token-test",
      verificationTokenExpires: expiresVerification,
      resetPasswordToken: "reset-token-test",
      resetPasswordExpires: expiresReset,
    });

    expect(created.refreshSessionVersion ?? 0).toBe(0);
    expect(created.personalDetails.emailVerified).toBe(false);
    expect(created.verificationToken).toBe("confirm-token-test");
    expect(created.verificationTokenExpires?.getTime()).toBe(
      expiresVerification.getTime(),
    );
    expect(created.resetPasswordToken).toBe("reset-token-test");
    expect(created.resetPasswordExpires?.getTime()).toBe(expiresReset.getTime());

    const fromDb = await User.findById(created._id).lean();
    expect(fromDb?.personalDetails?.emailVerified).toBe(false);
    expect(fromDb).not.toHaveProperty("emailVerified");
    expect(fromDb?.verificationToken).toBe("confirm-token-test");
    expect(fromDb?.verificationTokenExpires?.getTime()).toBe(
      expiresVerification.getTime(),
    );
    expect(fromDb?.resetPasswordToken).toBe("reset-token-test");
  });

  it("finds user by verificationToken", async () => {
    await User.create({
      personalDetails: {
        ...minimalPersonalDetails,
        email: "find-by-confirm@example.com",
        username: "findbyconfirm",
        idNumber: "ID-SCHEMA-002",
      },
      verificationToken: "unique-confirm-token",
    });

    const found = await User.findOne({
      verificationToken: "unique-confirm-token",
    }).lean();
    expect(found?.personalDetails?.email).toBe("find-by-confirm@example.com");
  });

  it("stores an optional Google subject for active users", async () => {
    const created = await User.create({
      googleId: "google-subject-schema",
      personalDetails: {
        ...minimalPersonalDetails,
        email: "google-schema@example.com",
        username: "googleschema",
        idNumber: "ID-SCHEMA-GOOGLE",
      },
    });

    const fromDb = await User.findById(created._id).lean();
    expect(fromDb?.googleId).toBe("google-subject-schema");
  });

  it("defaults privacy acceptance and marketing consent off with no consent timestamps", async () => {
    const created = await User.create({
      personalDetails: {
        ...minimalPersonalDetails,
        email: "consent-defaults@example.com",
        username: "consentdefaults",
        idNumber: "ID-SCHEMA-CONSENT",
      },
    });

    expect(created.privacyAccepted).toBe(false);
    expect(created.marketingConsent).toBe(false);
    expect(created.privacyAcceptedAt).toBeUndefined();
    expect(created.marketingConsentUpdatedAt).toBeUndefined();
  });

  it("reads legacy rows without consent fields as not accepted and marketing off", async () => {
    const inserted = await User.collection.insertOne({
      personalDetails: {
        ...minimalPersonalDetails,
        email: "legacy-consent@example.com",
        username: "legacyconsent",
        idNumber: "ID-SCHEMA-LEGACY",
      },
    });

    const legacy = await User.findById(inserted.insertedId);
    expect(legacy?.privacyAccepted).toBe(false);
    expect(legacy?.marketingConsent).toBe(false);
    expect(legacy?.privacyAcceptedAt).toBeUndefined();
    expect(legacy?.marketingConsentUpdatedAt).toBeUndefined();
  });

  it("clears token fields when unset", async () => {
    const doc = await User.create({
      personalDetails: {
        ...minimalPersonalDetails,
        email: "clear-tokens@example.com",
        username: "cleartokens",
        idNumber: "ID-SCHEMA-003",
      },
      verificationToken: "to-clear",
    });

    await User.findByIdAndUpdate(doc._id, {
      $unset: {
        verificationToken: "",
      },
    });

    const after = await User.findById(doc._id).lean();
    expect(after?.verificationToken).toBeUndefined();
  });
});

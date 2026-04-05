/**
 * Phase 1.1 — User auth-email fields persist and are queryable.
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
  it("defaults emailVerified to false and stores token hashes and expiries", async () => {
    const expiresConfirm = new Date(Date.now() + 86_400_000);
    const expiresReset = new Date(Date.now() + 3_600_000);

    const created = await User.create({
      personalDetails: minimalPersonalDetails,
      emailVerificationTokenHash: "confirm-hash-test",
      emailVerificationExpiresAt: expiresConfirm,
      passwordResetTokenHash: "reset-hash-test",
      passwordResetExpiresAt: expiresReset,
    });

    expect(created.refreshSessionVersion ?? 0).toBe(0);
    expect(created.emailVerified).toBe(false);
    expect(created.emailVerificationTokenHash).toBe("confirm-hash-test");
    expect(created.emailVerificationExpiresAt?.getTime()).toBe(
      expiresConfirm.getTime(),
    );
    expect(created.passwordResetTokenHash).toBe("reset-hash-test");
    expect(created.passwordResetExpiresAt?.getTime()).toBe(
      expiresReset.getTime(),
    );

    const fromDb = await User.findById(created._id).lean();
    expect(fromDb?.emailVerified).toBe(false);
    expect(fromDb?.emailVerificationTokenHash).toBe("confirm-hash-test");
    expect(fromDb?.passwordResetTokenHash).toBe("reset-hash-test");
  });

  it("finds user by emailVerificationTokenHash", async () => {
    await User.create({
      personalDetails: {
        ...minimalPersonalDetails,
        email: "find-by-confirm@example.com",
        username: "findbyconfirm",
        idNumber: "ID-SCHEMA-002",
      },
      emailVerificationTokenHash: "unique-confirm-hash",
      emailVerificationExpiresAt: new Date(Date.now() + 60_000),
    });

    const found = await User.findOne({
      emailVerificationTokenHash: "unique-confirm-hash",
    }).lean();
    expect(found?.personalDetails?.email).toBe("find-by-confirm@example.com");
  });

  it("clears token fields when unset", async () => {
    const doc = await User.create({
      personalDetails: {
        ...minimalPersonalDetails,
        email: "clear-tokens@example.com",
        username: "cleartokens",
        idNumber: "ID-SCHEMA-003",
      },
      emailVerificationTokenHash: "to-clear",
      emailVerificationExpiresAt: new Date(),
    });

    await User.findByIdAndUpdate(doc._id, {
      $unset: {
        emailVerificationTokenHash: "",
        emailVerificationExpiresAt: "",
      },
    });

    const after = await User.findById(doc._id).lean();
    expect(after?.emailVerificationTokenHash).toBeUndefined();
    expect(after?.emailVerificationExpiresAt).toBeUndefined();
  });
});

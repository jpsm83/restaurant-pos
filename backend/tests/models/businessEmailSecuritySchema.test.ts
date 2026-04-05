/**
 * Phase 1.2 — Business auth-email fields persist and are queryable.
 */
import { describe, it, expect } from "vitest";
import Business from "../../src/models/business.ts";

const minimalBusiness = {
  tradeName: "Schema Test Bistro",
  legalName: "Schema Test Bistro LLC",
  email: "biz-schema-test@example.com",
  password: "hashed-placeholder",
  phoneNumber: "1234567890",
  taxNumber: "TAX-SCHEMA-BIZ-001",
  currencyTrade: "USD",
  address: {
    country: "USA",
    state: "CA",
    city: "LA",
    street: "Main St",
    buildingNumber: "1",
    postCode: "90001",
  },
};

describe("Business email security schema", () => {
  it("defaults emailVerified to false and stores token hashes and expiries", async () => {
    const expiresConfirm = new Date(Date.now() + 86_400_000);
    const expiresReset = new Date(Date.now() + 3_600_000);

    const created = await Business.create({
      ...minimalBusiness,
      taxNumber: "TAX-SCHEMA-BIZ-002",
      email: "biz-schema-a@example.com",
      emailVerificationTokenHash: "biz-confirm-hash",
      emailVerificationExpiresAt: expiresConfirm,
      passwordResetTokenHash: "biz-reset-hash",
      passwordResetExpiresAt: expiresReset,
    });

    expect(created.refreshSessionVersion ?? 0).toBe(0);
    expect(created.emailVerified).toBe(false);
    expect(created.emailVerificationTokenHash).toBe("biz-confirm-hash");
    expect(created.emailVerificationExpiresAt?.getTime()).toBe(
      expiresConfirm.getTime(),
    );
    expect(created.passwordResetTokenHash).toBe("biz-reset-hash");
    expect(created.passwordResetExpiresAt?.getTime()).toBe(
      expiresReset.getTime(),
    );

    const fromDb = await Business.findById(created._id).lean();
    expect(fromDb?.emailVerified).toBe(false);
    expect(fromDb?.emailVerificationTokenHash).toBe("biz-confirm-hash");
    expect(fromDb?.passwordResetTokenHash).toBe("biz-reset-hash");
  });

  it("finds business by passwordResetTokenHash", async () => {
    await Business.create({
      ...minimalBusiness,
      taxNumber: "TAX-SCHEMA-BIZ-003",
      email: "biz-find-reset@example.com",
      passwordResetTokenHash: "unique-biz-reset-hash",
      passwordResetExpiresAt: new Date(Date.now() + 60_000),
    });

    const found = await Business.findOne({
      passwordResetTokenHash: "unique-biz-reset-hash",
    }).lean();
    expect(found?.email).toBe("biz-find-reset@example.com");
  });

  it("clears token fields when unset", async () => {
    const doc = await Business.create({
      ...minimalBusiness,
      taxNumber: "TAX-SCHEMA-BIZ-004",
      email: "biz-clear@example.com",
      passwordResetTokenHash: "to-clear-biz",
      passwordResetExpiresAt: new Date(),
    });

    await Business.findByIdAndUpdate(doc._id, {
      $unset: {
        passwordResetTokenHash: "",
        passwordResetExpiresAt: "",
      },
    });

    const after = await Business.findById(doc._id).lean();
    expect(after?.passwordResetTokenHash).toBeUndefined();
    expect(after?.passwordResetExpiresAt).toBeUndefined();
  });
});

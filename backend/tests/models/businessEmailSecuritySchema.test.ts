/**
 * Business auth-email fields persist and are queryable.
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
  it("defaults emailVerified to false and stores verification + reset tokens", async () => {
    const expiresReset = new Date(Date.now() + 3_600_000);

    const created = await Business.create({
      ...minimalBusiness,
      taxNumber: "TAX-SCHEMA-BIZ-002",
      email: "biz-schema-a@example.com",
      verificationToken: "biz-confirm-token",
      resetPasswordToken: "biz-reset-token",
      resetPasswordExpires: expiresReset,
    });

    expect(created.refreshSessionVersion ?? 0).toBe(0);
    expect(created.emailVerified).toBe(false);
    expect(created.verificationToken).toBe("biz-confirm-token");
    expect(created.resetPasswordToken).toBe("biz-reset-token");
    expect(created.resetPasswordExpires?.getTime()).toBe(expiresReset.getTime());

    const fromDb = await Business.findById(created._id).lean();
    expect(fromDb?.emailVerified).toBe(false);
    expect(fromDb?.verificationToken).toBe("biz-confirm-token");
    expect(fromDb?.resetPasswordToken).toBe("biz-reset-token");
  });

  it("finds business by resetPasswordToken", async () => {
    await Business.create({
      ...minimalBusiness,
      taxNumber: "TAX-SCHEMA-BIZ-003",
      email: "biz-find-reset@example.com",
      resetPasswordToken: "unique-biz-reset-token",
      resetPasswordExpires: new Date(Date.now() + 60_000),
    });

    const found = await Business.findOne({
      resetPasswordToken: "unique-biz-reset-token",
    }).lean();
    expect(found?.email).toBe("biz-find-reset@example.com");
  });

  it("clears token fields when unset", async () => {
    const doc = await Business.create({
      ...minimalBusiness,
      taxNumber: "TAX-SCHEMA-BIZ-004",
      email: "biz-clear@example.com",
      resetPasswordToken: "to-clear-biz",
      resetPasswordExpires: new Date(),
    });

    await Business.findByIdAndUpdate(doc._id, {
      $unset: {
        resetPasswordToken: "",
        resetPasswordExpires: "",
      },
    });

    const after = await Business.findById(doc._id).lean();
    expect(after?.resetPasswordToken).toBeUndefined();
    expect(after?.resetPasswordExpires).toBeUndefined();
  });
});

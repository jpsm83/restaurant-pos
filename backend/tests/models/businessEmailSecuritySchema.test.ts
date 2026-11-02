/**
 * Business contact-email fields persist as venue data; no credentials exist.
 */
import { describe, it, expect } from "vitest";
import Business from "../../src/models/business.ts";
import { createTestBusiness } from "../helpers/fixtures.ts";

const minimalBusiness = {
  tradeName: "Schema Test Bistro",
  legalName: "Schema Test Bistro LLC",
  email: "biz-schema-test@example.com",
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

describe("Business contact email schema", () => {
  it("defaults emailVerified to false and stores the venue contact email", async () => {
    const created = await createTestBusiness({
      ...minimalBusiness,
      taxNumber: "TAX-SCHEMA-BIZ-002",
      email: "biz-schema-a@example.com",
    });

    expect(created.email).toBe("biz-schema-a@example.com");
    expect(created.emailVerified).toBe(false);

    const fromDb = await Business.findById(created._id).lean();
    expect(fromDb?.email).toBe("biz-schema-a@example.com");
    expect(fromDb?.emailVerified).toBe(false);
  });

  it("stores a verified contact email", async () => {
    const created = await createTestBusiness({
      ...minimalBusiness,
      taxNumber: "TAX-SCHEMA-BIZ-003",
      email: "biz-verified@example.com",
      emailVerified: true,
    });

    const fromDb = await Business.findById(created._id).lean();
    expect(fromDb?.emailVerified).toBe(true);
  });

  it("stores a contact verification token, its 24-hour expiry, and the last request time", async () => {
    const token = "a".repeat(64);
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const requestedAt = new Date();

    const created = await createTestBusiness({
      ...minimalBusiness,
      taxNumber: "TAX-SCHEMA-BIZ-004",
      email: "biz-token@example.com",
      contactVerificationToken: token,
      contactVerificationTokenExpires: expires,
      contactVerificationRequestedAt: requestedAt,
    });

    const fromDb = await Business.findById(created._id)
      .select(
        "contactVerificationToken contactVerificationTokenExpires contactVerificationRequestedAt",
      )
      .lean();
    expect(fromDb?.contactVerificationToken).toBe(token);
    expect(fromDb?.contactVerificationTokenExpires?.getTime()).toBe(
      expires.getTime(),
    );
    expect(fromDb?.contactVerificationRequestedAt?.getTime()).toBe(
      requestedAt.getTime(),
    );
  });

  it("defines no credential or session-generation fields", () => {
    for (const field of [
      "password",
      "verificationToken",
      "resetPasswordToken",
      "resetPasswordExpires",
      "pendingEmail",
      "pendingEmailToken",
      "pendingEmailExpires",
      "pendingEmailRequestedAt",
      "refreshSessionVersion",
    ]) {
      expect(Business.schema.path(field), field).toBeUndefined();
    }
  });
});

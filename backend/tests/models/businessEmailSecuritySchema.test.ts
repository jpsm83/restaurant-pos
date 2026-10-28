/**
 * Business contact-email fields persist as venue data; no credentials exist.
 */
import { describe, it, expect } from "vitest";
import Business from "../../src/models/business.ts";

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
    const created = await Business.create({
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
    const created = await Business.create({
      ...minimalBusiness,
      taxNumber: "TAX-SCHEMA-BIZ-003",
      email: "biz-verified@example.com",
      emailVerified: true,
    });

    const fromDb = await Business.findById(created._id).lean();
    expect(fromDb?.emailVerified).toBe(true);
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

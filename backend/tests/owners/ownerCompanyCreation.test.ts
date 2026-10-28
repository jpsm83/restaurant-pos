import { beforeAll, describe, expect, it } from "vitest";
import { Types } from "mongoose";

import Business from "../../src/models/business.ts";
import Company from "../../src/models/company.ts";
import Owner from "../../src/models/owner.ts";
import User from "../../src/models/user.ts";
import ownerCompanyCreation, {
  type BusinessCreationInput,
} from "../../src/owners/ownerCompanyCreation.ts";
import {
  fakeAddress,
  fakeBusinessRecord,
  fakeCompany,
  fakeOwner,
} from "../helpers/fixtures.ts";

async function createUser(label: string) {
  return User.create({
    personalDetails: {
      username: `owner-${label}`,
      email: `owner-${label}@example.com`,
      password: "hashed-password",
      idType: "Passport",
      idNumber: `OWNER-${label}`,
      address: fakeAddress(),
      firstName: "Owner",
      lastName: label,
      nationality: "Spain",
      gender: "Other",
      birthDate: new Date("1990-01-01"),
      phoneNumber: "600000000",
    },
  });
}

function venue(country: string, businessId = new Types.ObjectId()) {
  return {
    ...fakeBusinessRecord({ country }),
    _id: businessId,
  } as BusinessCreationInput;
}

describe("ownerCompanyCreation", () => {
  beforeAll(async () => {
    await Promise.all([Owner.syncIndexes(), Company.syncIndexes()]);
  });

  it("creates the Owner, Company, and Business in one call", async () => {
    const user = await createUser("creates-all");

    const result = await ownerCompanyCreation({
      userId: user._id,
      business: venue("Spain"),
    });

    expect(result.owner.userId.toString()).toBe(user._id.toString());
    expect(result.owner.country).toBe("Spain");
    expect(result.owner.subscription).toBe("Free");
    expect(result.company.ownerId.toString()).toBe(result.owner._id.toString());
    expect(result.company.country).toBe("Spain");
    expect(result.business.companyId?.toString()).toBe(
      result.company._id.toString(),
    );

    await expect(Owner.countDocuments({ userId: user._id })).resolves.toBe(1);
    await expect(Company.countDocuments({ ownerId: result.owner._id })).resolves.toBe(1);
    await expect(Business.countDocuments({ _id: result.business._id })).resolves.toBe(1);
  });

  it("is idempotent for the first venue when called again with the same Business id", async () => {
    const user = await createUser("idempotent");
    const businessId = new Types.ObjectId();

    const first = await ownerCompanyCreation({
      userId: user._id,
      business: venue("Spain", businessId),
    });
    const second = await ownerCompanyCreation({
      userId: user._id,
      business: venue("Spain", businessId),
    });

    expect(second.owner._id.toString()).toBe(first.owner._id.toString());
    expect(second.company._id.toString()).toBe(first.company._id.toString());
    await expect(Owner.countDocuments({ userId: user._id })).resolves.toBe(1);
    await expect(Company.countDocuments({ ownerId: first.owner._id })).resolves.toBe(1);
    await expect(Business.countDocuments({ _id: businessId })).resolves.toBe(1);
  });

  it("reuses the Owner but forms a new Company for a later venue without a Company id", async () => {
    const user = await createUser("new-company");

    const first = await ownerCompanyCreation({
      userId: user._id,
      business: venue("Spain"),
    });
    const second = await ownerCompanyCreation({
      userId: user._id,
      business: venue("Spain"),
    });

    expect(second.owner._id.toString()).toBe(first.owner._id.toString());
    expect(second.company._id.toString()).not.toBe(first.company._id.toString());
    await expect(Owner.countDocuments({ userId: user._id })).resolves.toBe(1);
    await expect(Company.countDocuments({ ownerId: first.owner._id })).resolves.toBe(2);
  });

  it("accepts an existing Company owned by the same Owner", async () => {
    const user = await createUser("join-company");

    const first = await ownerCompanyCreation({
      userId: user._id,
      business: venue("Spain"),
      company: { legalName: "Taxpayer SL", taxNumber: "ES-123" },
    });
    const second = await ownerCompanyCreation({
      userId: user._id,
      business: venue("Spain"),
      companyId: first.company._id,
    });

    expect(second.owner._id.toString()).toBe(first.owner._id.toString());
    expect(second.company._id.toString()).toBe(first.company._id.toString());
    expect(second.company.legalName).toBe("Taxpayer SL");
    expect(second.business.companyId?.toString()).toBe(
      first.company._id.toString(),
    );
    await expect(Company.countDocuments({ ownerId: first.owner._id })).resolves.toBe(1);
  });

  it("refuses to adopt an existing Business that has no owning Company", async () => {
    const user = await createUser("orphan-business");
    const business = await Business.create(venue("Spain"));

    await expect(
      ownerCompanyCreation({
        userId: user._id,
        business: venue("Spain", business._id),
      }),
    ).rejects.toThrow(/without an owning Company/i);

    const stored = await Business.findById(business._id).lean();
    expect(stored?.companyId).toBeUndefined();
  });

  it("rolls the Owner and Company back when the Business cannot be created", async () => {
    const user = await createUser("rollback");
    const { tradeName: _tradeName, ...incompleteBusiness } = venue("Spain");

    await expect(
      ownerCompanyCreation({
        userId: user._id,
        business: incompleteBusiness as BusinessCreationInput,
      }),
    ).rejects.toThrow();

    await expect(Owner.countDocuments({ userId: user._id })).resolves.toBe(0);
    await expect(Company.countDocuments({ country: "Spain" })).resolves.toBe(0);
    await expect(
      Business.countDocuments({ _id: incompleteBusiness._id }),
    ).resolves.toBe(0);
  });

  it("rejects a venue in a different country and rolls the Business back", async () => {
    const user = await createUser("country-mismatch");

    const first = await ownerCompanyCreation({
      userId: user._id,
      business: venue("Spain"),
    });

    await expect(
      ownerCompanyCreation({
        userId: user._id,
        business: venue("France"),
      }),
    ).rejects.toThrow(/portfolio country/i);

    await expect(Owner.countDocuments({ userId: user._id })).resolves.toBe(1);
    await expect(
      Company.countDocuments({ ownerId: first.owner._id }),
    ).resolves.toBe(1);
    await expect(
      Business.countDocuments({ "address.country": "France" }),
    ).resolves.toBe(0);
  });

  it("rejects a Company whose country differs from the Owner portfolio", async () => {
    const user = await createUser("company-country");
    const first = await ownerCompanyCreation({
      userId: user._id,
      business: venue("Spain"),
    });
    const foreignCompany = await Company.create({
      ownerId: first.owner._id,
      country: "Portugal",
    });

    await expect(
      ownerCompanyCreation({
        userId: user._id,
        business: venue("Spain"),
        companyId: foreignCompany._id,
      }),
    ).rejects.toThrow(/Company country/i);
  });

  it("rejects a Company that belongs to another Owner", async () => {
    const firstUser = await createUser("first-owner");
    const secondUser = await createUser("second-owner");

    await ownerCompanyCreation({
      userId: firstUser._id,
      business: venue("Spain"),
    });
    const second = await ownerCompanyCreation({
      userId: secondUser._id,
      business: venue("Spain"),
    });

    await expect(
      ownerCompanyCreation({
        userId: firstUser._id,
        business: venue("Spain"),
        companyId: second.company._id,
      }),
    ).rejects.toThrow(/does not belong/i);

    await expect(
      Business.countDocuments({ companyId: second.company._id }),
    ).resolves.toBe(1);
  });

  it("allows an incomplete draft Company", async () => {
    const user = await createUser("draft-company");

    const result = await ownerCompanyCreation({
      userId: user._id,
      business: venue("Spain"),
    });

    expect(result.company.legalName).toBeUndefined();
    expect(result.company.taxNumber).toBeUndefined();
  });

  it("keeps legal name and tax number unique among active Companies in the same country only when present", async () => {
    const owner = await Owner.create(
      fakeOwner(new Types.ObjectId().toString(), { country: "Spain" }),
    );
    const otherCountryOwner = await Owner.create(
      fakeOwner(new Types.ObjectId().toString(), { country: "Portugal" }),
    );

    await Company.create(
      fakeCompany(owner._id.toString(), {
        country: "Spain",
        legalName: "Taxpayer SL",
        taxNumber: "ES-123",
      }),
    );

    await expect(
      Company.create(
        fakeCompany(owner._id.toString(), {
          country: "Spain",
          legalName: "Taxpayer SL",
          taxNumber: "ES-999",
        }),
      ),
    ).rejects.toThrow();
    await expect(
      Company.create(
        fakeCompany(owner._id.toString(), {
          country: "Spain",
          legalName: "Another SL",
          taxNumber: "ES-123",
        }),
      ),
    ).rejects.toThrow();

    await expect(
      Company.create(
        fakeCompany(otherCountryOwner._id.toString(), {
          country: "Portugal",
          legalName: "Taxpayer SL",
          taxNumber: "ES-123",
        }),
      ),
    ).resolves.toBeDefined();

    await expect(
      Company.create({ ownerId: owner._id, country: "Spain" }),
    ).resolves.toBeDefined();
    await expect(
      Company.create({ ownerId: owner._id, country: "Spain" }),
    ).resolves.toBeDefined();
  });

  it("lets a soft-deleted Company release its legal name and tax number", async () => {
    const owner = await Owner.create(
      fakeOwner(new Types.ObjectId().toString(), { country: "Spain" }),
    );

    const deletedCompany = await Company.create({
      ...fakeCompany(owner._id.toString(), {
        country: "Spain",
        legalName: "Taxpayer SL",
        taxNumber: "ES-123",
      }),
      deleted: true,
      deletedAt: new Date(),
    });

    await expect(
      Company.create(
        fakeCompany(owner._id.toString(), {
          country: "Spain",
          legalName: "Taxpayer SL",
          taxNumber: "ES-123",
        }),
      ),
    ).resolves.toBeDefined();
    await expect(
      Company.findById(deletedCompany._id),
    ).resolves.toBeNull();
  });
});

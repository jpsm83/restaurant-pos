/**
 * Owner route tests — self-scoped portfolio read, Company update, draft
 * completeness signal, owner scoping and conflict handling.
 */

import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { getTestApp, generateTestToken } from "../setup.ts";
import { createTestBusiness } from "../helpers/fixtures.ts";
import Business from "../../src/models/business.ts";
import Company from "../../src/models/company.ts";
import Owner from "../../src/models/owner.ts";
import User from "../../src/models/user.ts";

async function customerAuthToken(): Promise<{ auth: string; userId: string }> {
  const userId = new Types.ObjectId();
  await User.create({
    _id: userId,
    personalDetails: {
      email: `portfolio-${userId}@test.com`,
      firstName: "Portfolio",
      lastName: "Owner",
    },
  });
  const auth = await generateTestToken({
    id: userId.toString(),
    email: `portfolio-${userId}@test.com`,
    type: "user",
    role: "Customer",
  });
  return { auth, userId: userId.toString() };
}

const completeAddress = {
  country: "USA",
  state: "CA",
  city: "Los Angeles",
  street: "Main St",
  buildingNumber: "123",
  postCode: "90001",
};

describe("GET /api/v1/owners/portfolio", () => {
  it("requires authentication", async () => {
    const app = await getTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/owners/portfolio",
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
  });

  it("returns an empty portfolio for a User with no Owner", async () => {
    const app = await getTestApp();
    const { auth } = await customerAuthToken();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/owners/portfolio",
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      owner: null,
      country: null,
      subscription: null,
      companies: [],
    });
  });

  it("keeps the Owner, country and subscription when the Owner has no Companies", async () => {
    const app = await getTestApp();
    const { auth, userId } = await customerAuthToken();
    const owner = await Owner.create({ userId, country: "Spain" });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/owners/portfolio",
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.owner).toEqual({
      _id: owner._id.toString(),
      country: "Spain",
      subscription: "Free",
    });
    expect(body.country).toBe("Spain");
    expect(body.subscription).toBe("Free");
    expect(body.companies).toEqual([]);
  });

  it("returns the first registered venue under the caller's Owner", async () => {
    const app = await getTestApp();
    const { auth, userId } = await customerAuthToken();

    const registration = await app.inject({
      method: "POST",
      url: "/api/v1/business",
      headers: { authorization: auth },
      payload: {
        tradeName: "Draft Venue",
        country: "USA",
        currencyTrade: "USD",
        company: { legalName: "Draft Venue LLC", taxNumber: "TAX-230" },
      },
    });
    expect(registration.statusCode).toBe(201);
    const created = JSON.parse(registration.body);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/owners/portfolio",
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const owner = await Owner.findOne({ userId });
    expect(body.owner).toEqual({
      _id: owner!._id.toString(),
      country: "USA",
      subscription: "Free",
    });
    expect(body.country).toBe("USA");
    expect(body.subscription).toBe("Free");
    expect(body.companies).toHaveLength(1);
    expect(body.companies[0]).toMatchObject({
      _id: created.company._id,
      country: "USA",
      legalName: "Draft Venue LLC",
      taxNumber: "TAX-230",
    });
    expect(body.companies[0].businesses).toHaveLength(1);
    expect(body.companies[0].businesses[0]).toMatchObject({
      _id: created.business._id,
      tradeName: "Draft Venue",
      currencyTrade: "USD",
      companyId: created.company._id,
      profileComplete: false,
    });
  });

  it("never returns another Owner's portfolio", async () => {
    const app = await getTestApp();
    const caller = await customerAuthToken();
    const other = await customerAuthToken();

    const callerOwner = await Owner.create({
      userId: caller.userId,
      country: "USA",
    });
    const callerCompany = await Company.create({
      ownerId: callerOwner._id,
      country: "USA",
      legalName: "Caller Taxpayer",
      taxNumber: "CALLER-TAX",
    });
    await createTestBusiness({
      tradeName: "Caller Venue",
      currencyTrade: "USD",
      address: { country: "USA" },
      companyId: callerCompany._id,
    });

    const otherOwner = await Owner.create({
      userId: other.userId,
      country: "Canada",
    });
    const otherCompany = await Company.create({
      ownerId: otherOwner._id,
      country: "Canada",
      legalName: "Other Taxpayer",
      taxNumber: "OTHER-TAX",
    });
    await createTestBusiness({
      tradeName: "Other Venue",
      currencyTrade: "CAD",
      address: { country: "Canada" },
      companyId: otherCompany._id,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/owners/portfolio",
      headers: { authorization: caller.auth },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.owner._id).toBe(callerOwner._id.toString());
    expect(body.country).toBe("USA");
    expect(body.companies).toHaveLength(1);
    expect(body.companies[0]._id).toBe(callerCompany._id.toString());
    expect(body.companies[0].businesses).toHaveLength(1);
    expect(body.companies[0].businesses[0].tradeName).toBe("Caller Venue");
    expect(response.body).not.toContain("Other Venue");
    expect(response.body).not.toContain("Canada");
  });

  it("omits a soft-deleted Company and its Businesses from the portfolio", async () => {
    const app = await getTestApp();
    const { auth, userId } = await customerAuthToken();
    const owner = await Owner.create({ userId, country: "USA" });
    const deletedCompany = await Company.create({
      ownerId: owner._id,
      country: "USA",
      legalName: "Deleted Portfolio Llc",
      taxNumber: "DELETED-PORTFOLIO-TAX",
      deleted: true,
      deletedAt: new Date(),
    });
    await createTestBusiness({
      tradeName: "Deleted Portfolio Venue",
      currencyTrade: "USD",
      address: { country: "USA" },
      companyId: deletedCompany._id,
    });
    const activeCompany = await Company.create({
      ownerId: owner._id,
      country: "USA",
      legalName: "Active Portfolio Llc",
      taxNumber: "ACTIVE-PORTFOLIO-TAX",
    });
    await createTestBusiness({
      tradeName: "Active Portfolio Venue",
      currencyTrade: "USD",
      address: { country: "USA" },
      companyId: activeCompany._id,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/owners/portfolio",
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.companies).toHaveLength(1);
    expect(body.companies[0]._id).toBe(activeCompany._id.toString());
    expect(body.companies[0].businesses).toHaveLength(1);
    expect(body.companies[0].businesses[0].tradeName).toBe(
      "Active Portfolio Venue",
    );
    expect(response.body).not.toContain("Deleted Portfolio Llc");
    expect(response.body).not.toContain("Deleted Portfolio Venue");
  });

  it("omits a soft-deleted Business while keeping active siblings", async () => {
    const app = await getTestApp();
    const { auth, userId } = await customerAuthToken();
    const owner = await Owner.create({ userId, country: "USA" });
    const company = await Company.create({
      ownerId: owner._id,
      country: "USA",
      legalName: "Sibling Portfolio Llc",
      taxNumber: "SIBLING-PORTFOLIO-TAX",
    });
    await createTestBusiness({
      tradeName: "Deleted Sibling Venue",
      currencyTrade: "USD",
      address: { country: "USA" },
      companyId: company._id,
      deleted: true,
      deletedAt: new Date(),
    });
    await createTestBusiness({
      tradeName: "Active Sibling Venue",
      currencyTrade: "USD",
      address: { country: "USA" },
      companyId: company._id,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/owners/portfolio",
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.companies).toHaveLength(1);
    expect(body.companies[0]._id).toBe(company._id.toString());
    expect(body.companies[0].businesses).toHaveLength(1);
    expect(body.companies[0].businesses[0].tradeName).toBe(
      "Active Sibling Venue",
    );
    expect(response.body).not.toContain("Deleted Sibling Venue");
  });

  it("returns every active Company and Business in the read model's stable order", async () => {
    const app = await getTestApp();
    const { auth, userId } = await customerAuthToken();
    const owner = await Owner.create({ userId, country: "USA" });

    const base = new Date("2026-01-01T00:00:00.000Z").getTime();
    const createdAt = (minutes: number) => new Date(base + minutes * 60_000);

    async function createCompany(name: string, taxNumber: string, at: Date) {
      const company = await Company.create({
        ownerId: owner._id,
        country: "USA",
        legalName: name,
        taxNumber,
      });
      await Company.collection.updateOne(
        { _id: company._id },
        { $set: { createdAt: at } },
      );
      return company;
    }

    async function createBusiness(
      tradeName: string,
      companyId: Types.ObjectId,
      at: Date,
    ) {
      const business = await createTestBusiness({
        tradeName,
        currencyTrade: "USD",
        address: { country: "USA" },
        companyId,
      });
      await Business.collection.updateOne(
        { _id: business._id },
        { $set: { createdAt: at } },
      );
      return business;
    }

    // Created in reverse createdAt order so the assertions prove the sort
    // rather than the accidental insertion order.
    const laterCompany = await createCompany(
      "Later Portfolio Llc",
      "LATER-PORTFOLIO-TAX",
      createdAt(20),
    );
    const earlierCompany = await createCompany(
      "Earlier Portfolio Llc",
      "EARLIER-PORTFOLIO-TAX",
      createdAt(10),
    );

    const laterBusiness = await createBusiness(
      "Later Venue",
      earlierCompany._id,
      createdAt(12),
    );
    const otherCompanyBusiness = await createBusiness(
      "Other Company Venue",
      laterCompany._id,
      createdAt(21),
    );
    const earlierBusiness = await createBusiness(
      "Earlier Venue",
      earlierCompany._id,
      createdAt(11),
    );

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/owners/portfolio",
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);

    expect(body.companies.map((company: { _id: string }) => company._id)).toEqual(
      [earlierCompany._id.toString(), laterCompany._id.toString()],
    );
    expect(
      body.companies[0].businesses.map(
        (business: { _id: string }) => business._id,
      ),
    ).toEqual([earlierBusiness._id.toString(), laterBusiness._id.toString()]);
    expect(
      body.companies[1].businesses.map(
        (business: { _id: string }) => business._id,
      ),
    ).toEqual([otherCompanyBusiness._id.toString()]);

    const returnedBusinessIds = body.companies.flatMap(
      (company: { businesses: { _id: string }[] }) =>
        company.businesses.map((business) => business._id),
    );
    expect(new Set(returnedBusinessIds)).toEqual(
      new Set(
        [
          earlierBusiness._id,
          laterBusiness._id,
          otherCompanyBusiness._id,
        ].map(String),
      ),
    );
  });

  it("marks a venue complete when profile fields and Company identity are present", async () => {
    const app = await getTestApp();
    const { auth, userId } = await customerAuthToken();
    const owner = await Owner.create({ userId, country: "USA" });
    const company = await Company.create({
      ownerId: owner._id,
      country: "USA",
      legalName: "Complete Venue LLC",
      taxNumber: "TAX-COMPLETE",
    });
    await createTestBusiness({
      tradeName: "Complete Venue",
      currencyTrade: "USD",
      phoneNumber: "+10000000000",
      email: "venue@complete.test",
      emailVerified: true,
      address: completeAddress,
      companyId: company._id,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/owners/portfolio",
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.companies[0].businesses[0].profileComplete).toBe(true);
  });

  it("does not mark a venue complete without verified contact and Company tax identity", async () => {
    const app = await getTestApp();
    const { auth, userId } = await customerAuthToken();
    const owner = await Owner.create({ userId, country: "USA" });
    const company = await Company.create({
      ownerId: owner._id,
      country: "USA",
      legalName: "Incomplete Venue LLC",
    });
    await createTestBusiness({
      tradeName: "Incomplete Venue",
      currencyTrade: "USD",
      phoneNumber: "+10000000000",
      email: "venue@incomplete.test",
      emailVerified: false,
      address: completeAddress,
      companyId: company._id,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/owners/portfolio",
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.companies[0].businesses[0].profileComplete).toBe(false);
  });
});

describe("PATCH /api/v1/owners/companies/:companyId", () => {
  async function ownerWithCompany(identity?: {
    legalName?: string;
    taxNumber?: string;
    country?: string;
  }): Promise<{
    auth: string;
    userId: string;
    ownerId: Types.ObjectId;
    companyId: string;
  }> {
    const { auth, userId } = await customerAuthToken();
    const country = identity?.country ?? "USA";
    const owner = await Owner.create({ userId, country });
    const company = await Company.create({
      ownerId: owner._id,
      country,
      legalName: identity?.legalName ?? "Old Legal Name",
      taxNumber: identity?.taxNumber ?? "OLD-TAX",
    });
    return {
      auth,
      userId,
      ownerId: owner._id,
      companyId: company._id.toString(),
    };
  }

  async function createDeletedCompany(
    ownerId: Types.ObjectId,
    identity: { legalName: string; taxNumber: string },
  ) {
    return Company.create({
      ownerId,
      country: "USA",
      ...identity,
      deleted: true,
      deletedAt: new Date(),
    });
  }

  it("requires authentication", async () => {
    const app = await getTestApp();

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/owners/companies/${new Types.ObjectId()}`,
      payload: { legalName: "New Name" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
  });

  it("updates the caller's Company legal name and tax number", async () => {
    const app = await getTestApp();
    const { auth, companyId } = await ownerWithCompany();

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/owners/companies/${companyId}`,
      headers: { authorization: auth },
      payload: { legalName: "Updated Name SL", taxNumber: "TAX-UPDATED" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(JSON.parse(response.body)).toEqual({
      _id: companyId,
      country: "USA",
      legalName: "Updated Name SL",
      taxNumber: "TAX-UPDATED",
    });
    const stored = await Company.findById(companyId);
    expect(stored?.legalName).toBe("Updated Name SL");
    expect(stored?.taxNumber).toBe("TAX-UPDATED");
  });

  it("clears a Company field when the client sends null", async () => {
    const app = await getTestApp();
    const { auth, companyId } = await ownerWithCompany();

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/owners/companies/${companyId}`,
      headers: { authorization: auth },
      payload: { legalName: null },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.legalName).toBeUndefined();
    expect(body.taxNumber).toBe("OLD-TAX");
    await expect(Company.findById(companyId)).resolves.toMatchObject({
      legalName: null,
      taxNumber: "OLD-TAX",
    });
  });

  it("rejects a blank legal name instead of storing an empty identity", async () => {
    const app = await getTestApp();
    const { auth, companyId } = await ownerWithCompany();

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/owners/companies/${companyId}`,
      headers: { authorization: auth },
      payload: { legalName: "   " },
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    await expect(Company.findById(companyId)).resolves.toMatchObject({
      legalName: "Old Legal Name",
    });
  });

  it("does not reveal another Owner's Company", async () => {
    const app = await getTestApp();
    const caller = await customerAuthToken();
    await Owner.create({ userId: caller.userId, country: "USA" });
    const other = await ownerWithCompany();

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/owners/companies/${other.companyId}`,
      headers: { authorization: caller.auth },
      payload: { legalName: "Hijacked Name" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    await expect(Company.findById(other.companyId)).resolves.toMatchObject({
      legalName: "Old Legal Name",
    });
  });

  it("refuses a signed-in User without the owning Owner", async () => {
    const app = await getTestApp();
    const staff = await customerAuthToken();
    const owner = await ownerWithCompany();

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/owners/companies/${owner.companyId}`,
      headers: { authorization: staff.auth },
      payload: { taxNumber: "STAFF-TAX" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    await expect(Company.findById(owner.companyId)).resolves.toMatchObject({
      taxNumber: "OLD-TAX",
    });
  });

  it("returns 404 for an unknown Company", async () => {
    const app = await getTestApp();
    const { auth, userId } = await customerAuthToken();
    await Owner.create({ userId, country: "USA" });

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/owners/companies/${new Types.ObjectId()}`,
      headers: { authorization: auth },
      payload: { legalName: "Missing Company" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
  });

  it("returns a conflict when an active Company already uses the identity", async () => {
    const app = await getTestApp();
    await Company.syncIndexes();
    const caller = await ownerWithCompany();
    const other = await ownerWithCompany({
      legalName: "Other Legal Name",
      taxNumber: "OTHER-TAX",
    });
    await Company.findByIdAndUpdate(other.companyId, {
      legalName: "Taken Name SL",
      taxNumber: "TAKEN-TAX",
    });

    const duplicateName = await app.inject({
      method: "PATCH",
      url: `/api/v1/owners/companies/${caller.companyId}`,
      headers: { authorization: caller.auth },
      payload: { legalName: "Taken Name SL", taxNumber: "FRESH-TAX" },
    });

    expect(duplicateName.statusCode).toBe(409);
    expect(duplicateName.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(JSON.parse(duplicateName.body).title).toBe("Conflict");
    await expect(Company.findById(caller.companyId)).resolves.toMatchObject({
      legalName: "Old Legal Name",
      taxNumber: "OLD-TAX",
    });

    const duplicateTax = await app.inject({
      method: "PATCH",
      url: `/api/v1/owners/companies/${caller.companyId}`,
      headers: { authorization: caller.auth },
      payload: { taxNumber: "TAKEN-TAX", legalName: "Fresh Name" },
    });

    expect(duplicateTax.statusCode).toBe(409);
    expect(duplicateTax.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(JSON.parse(duplicateTax.body).title).toBe("Conflict");
    await expect(Company.findById(caller.companyId)).resolves.toMatchObject({
      legalName: "Old Legal Name",
      taxNumber: "OLD-TAX",
    });
  });

  it("accepts the same identity when the other active Company is in a different country", async () => {
    const app = await getTestApp();
    await Company.syncIndexes();
    const caller = await ownerWithCompany();
    await ownerWithCompany({
      country: "Canada",
      legalName: "Shared Identity Ltd",
      taxNumber: "SHARED-TAX",
    });

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/owners/companies/${caller.companyId}`,
      headers: { authorization: caller.auth },
      payload: { legalName: "Shared Identity Ltd", taxNumber: "SHARED-TAX" },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      _id: caller.companyId,
      country: "USA",
      legalName: "Shared Identity Ltd",
      taxNumber: "SHARED-TAX",
    });
    await expect(Company.findById(caller.companyId)).resolves.toMatchObject({
      legalName: "Shared Identity Ltd",
      taxNumber: "SHARED-TAX",
    });
  });

  it("does not let a soft-deleted Company reserve an identity", async () => {
    const app = await getTestApp();
    await Company.syncIndexes();
    const caller = await ownerWithCompany();
    await createDeletedCompany(caller.ownerId, {
      legalName: "Retired Identity Ltd",
      taxNumber: "RETIRED-TAX",
    });

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/owners/companies/${caller.companyId}`,
      headers: { authorization: caller.auth },
      payload: { legalName: "Retired Identity Ltd", taxNumber: "RETIRED-TAX" },
    });

    expect(response.statusCode).toBe(200);
    await expect(Company.findById(caller.companyId)).resolves.toMatchObject({
      legalName: "Retired Identity Ltd",
      taxNumber: "RETIRED-TAX",
    });
  });

  it("returns 404 when asked to update a soft-deleted Company", async () => {
    const app = await getTestApp();
    const caller = await ownerWithCompany();
    const deletedCompany = await createDeletedCompany(caller.ownerId, {
      legalName: "Retired Identity Ltd",
      taxNumber: "RETIRED-TAX",
    });

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/owners/companies/${deletedCompany._id}`,
      headers: { authorization: caller.auth },
      payload: { legalName: "Resurrected Name" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(JSON.parse(response.body).title).toBe("Not Found");
    await expect(
      Company.findOne({ _id: deletedCompany._id, deleted: true }),
    ).resolves.toMatchObject({
      legalName: "Retired Identity Ltd",
      taxNumber: "RETIRED-TAX",
    });
  });

  it("leaves an omitted identity field unchanged", async () => {
    const app = await getTestApp();
    const { auth, companyId } = await ownerWithCompany();

    const nameOnly = await app.inject({
      method: "PATCH",
      url: `/api/v1/owners/companies/${companyId}`,
      headers: { authorization: auth },
      payload: { legalName: "Only The Name" },
    });

    expect(nameOnly.statusCode).toBe(200);
    await expect(Company.findById(companyId)).resolves.toMatchObject({
      legalName: "Only The Name",
      taxNumber: "OLD-TAX",
    });

    const taxOnly = await app.inject({
      method: "PATCH",
      url: `/api/v1/owners/companies/${companyId}`,
      headers: { authorization: auth },
      payload: { taxNumber: "ONLY-TAX" },
    });

    expect(taxOnly.statusCode).toBe(200);
    await expect(Company.findById(companyId)).resolves.toMatchObject({
      legalName: "Only The Name",
      taxNumber: "ONLY-TAX",
    });
  });

  it("validates a malformed Company id with problem details", async () => {
    const app = await getTestApp();
    const { auth } = await customerAuthToken();

    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/owners/companies/not-an-id",
      headers: { authorization: auth },
      payload: { legalName: "New Name" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
  });
});

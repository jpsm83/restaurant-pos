/**
 * Owner route tests — self-scoped portfolio read, Company update, draft
 * completeness signal, owner scoping and conflict handling.
 */

import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { getTestApp, generateTestToken } from "../setup.ts";
import { createTestBusiness } from "../helpers/fixtures.ts";
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
  }): Promise<{
    auth: string;
    userId: string;
    companyId: string;
  }> {
    const { auth, userId } = await customerAuthToken();
    const owner = await Owner.create({ userId, country: "USA" });
    const company = await Company.create({
      ownerId: owner._id,
      country: "USA",
      legalName: identity?.legalName ?? "Old Legal Name",
      taxNumber: identity?.taxNumber ?? "OLD-TAX",
    });
    return { auth, userId, companyId: company._id.toString() };
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
      payload: { legalName: "Taken Name SL" },
    });

    expect(duplicateName.statusCode).toBe(409);
    expect(duplicateName.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(JSON.parse(duplicateName.body).title).toBe("Conflict");

    const duplicateTax = await app.inject({
      method: "PATCH",
      url: `/api/v1/owners/companies/${caller.companyId}`,
      headers: { authorization: caller.auth },
      payload: { taxNumber: "TAKEN-TAX" },
    });

    expect(duplicateTax.statusCode).toBe(409);
    await expect(Company.findById(caller.companyId)).resolves.toMatchObject({
      legalName: "Old Legal Name",
      taxNumber: "OLD-TAX",
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

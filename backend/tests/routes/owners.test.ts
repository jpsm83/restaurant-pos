/**
 * Owner portfolio route tests — self-scoped read, empty portfolio and draft
 * completeness signal.
 */

import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { getTestApp, generateTestToken } from "../setup.ts";
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
    await Business.create({
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
    await Business.create({
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
    await Business.create({
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
    await Business.create({
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

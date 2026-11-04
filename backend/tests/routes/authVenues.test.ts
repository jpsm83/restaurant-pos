import { describe, expect, it } from "vitest";
import { Types } from "mongoose";

import Business from "../../src/models/business.ts";
import Company from "../../src/models/company.ts";
import Employee from "../../src/models/employee.ts";
import Schedule from "../../src/models/schedule.ts";
import User from "../../src/models/user.ts";
import { markAsDeletedById } from "../../src/models/softDelete.ts";
import { generateTestToken, getTestApp } from "../setup.ts";
import {
  createTestBusiness,
  createTestOwnerCompany,
} from "../helpers/fixtures.ts";

async function createSignedInUser(): Promise<{
  userId: string;
  auth: string;
}> {
  const userId = new Types.ObjectId();
  await User.create({
    _id: userId,
    personalDetails: {
      email: `venues-${userId}@test.com`,
      firstName: "Venue",
      lastName: "Reader",
    },
  });
  const auth = await generateTestToken({
    id: userId.toString(),
    email: `venues-${userId}@test.com`,
    type: "user",
    role: "Customer",
  });
  return { userId: userId.toString(), auth };
}

async function createMembership(params: {
  businessId: string;
  userId: string;
  roles?: string[];
  employmentStatus?: string;
  active?: boolean;
  terminated?: boolean;
  deleted?: boolean;
}) {
  return Employee.create({
    businessId: params.businessId,
    userId: params.userId,
    allEmployeeRoles: params.roles ?? ["Waiter"],
    taxNumber: `EMP-${new Types.ObjectId()}`,
    joinDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    vacationDaysPerYear: 20,
    employmentStatus: params.employmentStatus,
    active: params.active ?? true,
    terminatedDate:
      params.terminated || params.employmentStatus === "Terminated"
        ? new Date()
        : null,
    deleted: params.deleted ?? false,
  });
}

async function addShift(params: {
  businessId: string;
  employeeId: Types.ObjectId;
  start: Date;
}) {
  await Schedule.create({
    businessId: params.businessId,
    date: new Date(),
    weekNumber: 1,
    employeesSchedules: [
      {
        employeeId: params.employeeId,
        role: "Waiter",
        timeRange: {
          startTime: params.start,
          endTime: new Date(params.start.getTime() + 8 * 60 * 60 * 1000),
        },
        vacation: false,
        shiftHours: 8,
        employeeCost: 80,
      },
    ],
  });
}

function venueNames(body: { venues: Array<{ tradeName: string }> }): string[] {
  return body.venues.map((venue) => venue.tradeName);
}

describe("GET /api/v1/auth/venues", () => {
  it("requires a live signed-in User session", async () => {
    const app = await getTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/venues",
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
  });

  it("returns every owned venue across Companies ordered by trade name", async () => {
    const app = await getTestApp();
    const { user, owner, company } = await createTestOwnerCompany();
    const secondCompany = await Company.create({
      ownerId: owner._id,
      country: "USA",
    });
    await createTestBusiness({
      companyId: company._id,
      tradeName: "Zulu Kitchen",
      currencyTrade: "EUR",
    });
    await createTestBusiness({
      companyId: secondCompany._id,
      tradeName: "Alpha Bar",
      currencyTrade: "EUR",
    });
    const auth = await generateTestToken({
      id: user._id.toString(),
      email: "ordered-owner@test.com",
      type: "user",
      role: "Customer",
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/venues",
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(venueNames(body)).toEqual(["Alpha Bar", "Zulu Kitchen"]);
    expect(body.venues).toEqual([
      expect.objectContaining({
        tradeName: "Alpha Bar",
        source: "ownership",
        effectiveLayer: "admin",
        canEnterBusiness: true,
      }),
      expect.objectContaining({
        tradeName: "Zulu Kitchen",
        source: "ownership",
        effectiveLayer: "admin",
        canEnterBusiness: true,
      }),
    ]);
  });

  it("returns each usable membership venue for a member", async () => {
    const app = await getTestApp();
    const { userId, auth } = await createSignedInUser();
    const first = await createTestBusiness({
      tradeName: "Mike Cafe",
      currencyTrade: "EUR",
    });
    const second = await createTestBusiness({
      tradeName: "Bravo Diner",
      currencyTrade: "EUR",
    });
    await createMembership({
      businessId: first._id.toString(),
      userId,
      roles: ["Manager"],
    });
    await createMembership({
      businessId: second._id.toString(),
      userId,
      roles: ["Waiter"],
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/venues",
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(venueNames(body)).toEqual(["Bravo Diner", "Mike Cafe"]);
    expect(body.venues).toEqual([
      expect.objectContaining({
        tradeName: "Bravo Diner",
        source: "membership",
        effectiveLayer: "employee",
        jobRoles: ["Waiter"],
      }),
      expect.objectContaining({
        tradeName: "Mike Cafe",
        source: "membership",
        effectiveLayer: "manager",
        jobRoles: ["Manager"],
      }),
    ]);
  });

  it("lists an owned venue once with ownership when the caller is also a member", async () => {
    const app = await getTestApp();
    const { user, company } = await createTestOwnerCompany();
    const business = await createTestBusiness({
      companyId: company._id,
      tradeName: "Owner Staff Venue",
      currencyTrade: "EUR",
    });
    await createMembership({
      businessId: business._id.toString(),
      userId: user._id.toString(),
      roles: ["Waiter"],
    });
    const auth = await generateTestToken({
      id: user._id.toString(),
      email: "owner-staff-venues@test.com",
      type: "user",
      role: "Waiter",
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/venues",
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.venues).toHaveLength(1);
    expect(body.venues[0]).toMatchObject({
      businessId: business._id.toString(),
      tradeName: "Owner Staff Venue",
      source: "ownership",
      effectiveLayer: "admin",
      jobRoles: ["Waiter"],
      canEnterBusiness: true,
    });
  });

  it("lists owned venues before member venues", async () => {
    const app = await getTestApp();
    const { user, company } = await createTestOwnerCompany();
    await createTestBusiness({
      companyId: company._id,
      tradeName: "Zulu Owned",
      currencyTrade: "EUR",
    });
    const memberBusiness = await createTestBusiness({
      tradeName: "Alpha Member",
      currencyTrade: "EUR",
    });
    await createMembership({
      businessId: memberBusiness._id.toString(),
      userId: user._id.toString(),
      roles: ["Manager"],
    });
    const auth = await generateTestToken({
      id: user._id.toString(),
      email: "mixed-venues@test.com",
      type: "user",
      role: "Customer",
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/venues",
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    expect(venueNames(response.json())).toEqual([
      "Zulu Owned",
      "Alpha Member",
    ]);
  });

  it("keeps a schedule-gated membership listed but not enterable", async () => {
    const app = await getTestApp();
    const business = await createTestBusiness({
      tradeName: "Later Shift Venue",
      currencyTrade: "EUR",
    });
    const { userId, auth } = await createSignedInUser();
    const membership = await createMembership({
      businessId: business._id.toString(),
      userId,
      roles: ["Waiter"],
    });
    await addShift({
      businessId: business._id.toString(),
      employeeId: membership._id,
      start: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/venues",
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().venues).toEqual([
      expect.objectContaining({
        businessId: business._id.toString(),
        source: "membership",
        effectiveLayer: "employee",
        canEnterBusiness: false,
      }),
    ]);
  });

  it.each([
    ["suspended", { employmentStatus: "Suspended" }],
    ["terminated", { employmentStatus: "Terminated" }],
    ["legacy inactive", { active: false }],
    ["soft-deleted", { deleted: true }],
  ])("excludes a %s membership", async (_label, membershipState) => {
    const app = await getTestApp();
    const business = await createTestBusiness({
      tradeName: "Blocked Venue",
      currencyTrade: "EUR",
    });
    const { userId, auth } = await createSignedInUser();
    await createMembership({
      businessId: business._id.toString(),
      userId,
      roles: ["Manager"],
      ...membershipState,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/venues",
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().venues).toEqual([]);
  });

  it("excludes a membership whose Business is soft-deleted", async () => {
    const app = await getTestApp();
    const business = await createTestBusiness({
      tradeName: "Deleted Business Venue",
      currencyTrade: "EUR",
    });
    const { userId, auth } = await createSignedInUser();
    await createMembership({
      businessId: business._id.toString(),
      userId,
      roles: ["Manager"],
    });
    await markAsDeletedById(Business, business._id.toString());

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/venues",
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().venues).toEqual([]);
  });

  it("excludes a membership venue whose Company is soft-deleted", async () => {
    const app = await getTestApp();
    const business = await createTestBusiness({
      tradeName: "Company Deleted Membership Venue",
      currencyTrade: "EUR",
    });
    const { userId, auth } = await createSignedInUser();
    await createMembership({
      businessId: business._id.toString(),
      userId,
      roles: ["Manager"],
    });
    await markAsDeletedById(Company, business.companyId.toString());

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/venues",
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().venues).toEqual([]);
  });

  it("excludes an owned venue whose Business is soft-deleted", async () => {
    const app = await getTestApp();
    const { user, company } = await createTestOwnerCompany();
    const business = await createTestBusiness({
      companyId: company._id,
      tradeName: "Deleted Owned Venue",
      currencyTrade: "EUR",
    });
    await markAsDeletedById(Business, business._id.toString());
    const auth = await generateTestToken({
      id: user._id.toString(),
      email: "deleted-owned-business@test.com",
      type: "user",
      role: "Customer",
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/venues",
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().venues).toEqual([]);
  });

  it("excludes an owned venue whose Company is soft-deleted", async () => {
    const app = await getTestApp();
    const { user, company } = await createTestOwnerCompany();
    await createTestBusiness({
      companyId: company._id,
      tradeName: "Company Deleted Venue",
      currencyTrade: "EUR",
    });
    await markAsDeletedById(Company, company._id.toString());
    const auth = await generateTestToken({
      id: user._id.toString(),
      email: "deleted-owned-company@test.com",
      type: "user",
      role: "Customer",
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/venues",
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().venues).toEqual([]);
  });

  it("returns an empty list for a non-owner non-member and ignores a client-supplied User id", async () => {
    const app = await getTestApp();
    const outsider = await createSignedInUser();
    const member = await createSignedInUser();
    const business = await createTestBusiness({
      tradeName: "Private Venue",
      currencyTrade: "EUR",
    });
    await createMembership({
      businessId: business._id.toString(),
      userId: member.userId,
      roles: ["Manager"],
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/auth/venues?userId=${member.userId}`,
      headers: { authorization: outsider.auth },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ venues: [] });
  });
});

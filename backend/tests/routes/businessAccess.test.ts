import { describe, expect, it } from "vitest";
import { Types } from "mongoose";

import Employee from "../../src/models/employee.ts";
import Schedule from "../../src/models/schedule.ts";
import User from "../../src/models/user.ts";
import { generateTestToken, getTestApp } from "../setup.ts";
import {
  createTestBusiness,
  createTestOwnerCompany,
} from "../helpers/fixtures.ts";

const SERVICE_FLOOR_CAPABILITIES = [
  "openPrepScreens",
  "openDeliveryScreen",
  "openCustomerPickupBoard",
  "printPermission",
] as const;

const OPS_CAPABILITIES = [
  "markClearManualUnavailability",
  "viewInventory",
  "viewDailySalesReport",
  "viewWeeklyAndMonthlyBusinessReports",
] as const;

async function createSignedInUser(): Promise<{
  userId: string;
  auth: string;
}> {
  const userId = new Types.ObjectId();
  await User.create({
    _id: userId,
    personalDetails: {
      email: `access-${userId}@test.com`,
      firstName: "Access",
      lastName: "Tester",
    },
  });
  const auth = await generateTestToken({
    id: userId.toString(),
    email: `access-${userId}@test.com`,
    type: "user",
    role: "Customer",
  });
  return { userId: userId.toString(), auth };
}

async function createMembership(params: {
  businessId: string;
  userId: string;
  roles: string[];
  active?: boolean;
  terminated?: boolean;
  deleted?: boolean;
}) {
  const joinDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return Employee.create({
    businessId: params.businessId,
    userId: params.userId,
    allEmployeeRoles: params.roles,
    taxNumber: `EMP-${new Types.ObjectId()}`,
    joinDate,
    vacationDaysPerYear: 20,
    active: params.active ?? true,
    terminatedDate: params.terminated ? new Date() : null,
    deleted: params.deleted ?? false,
  });
}

async function addShift(params: {
  businessId: string;
  employeeId: Types.ObjectId;
  start: Date;
  vacation?: boolean;
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
        vacation: params.vacation ?? false,
        shiftHours: 8,
        employeeCost: 80,
      },
    ],
  });
}

describe("GET /api/v1/business/:businessId/access", () => {
  it("resolves an owning User without a membership to ownership admin", async () => {
    const app = await getTestApp();
    const { user, company } = await createTestOwnerCompany();
    const business = await createTestBusiness({
      companyId: company._id,
      tradeName: "Owned Venue",
      currencyTrade: "EUR",
    });
    const auth = await generateTestToken({
      id: user._id.toString(),
      email: "owner@test.com",
      type: "user",
      role: "Customer",
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/business/${business._id}/access`,
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      businessId: business._id.toString(),
      effectiveLayer: "admin",
      source: "ownership",
      jobRoles: [],
      capabilities: [...SERVICE_FLOOR_CAPABILITIES, ...OPS_CAPABILITIES],
      canEnterBusiness: true,
    });
  });

  it("keeps ownership as the source when the owning User also holds a membership", async () => {
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
      email: "owner-staff@test.com",
      type: "user",
      role: "Waiter",
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/business/${business._id}/access`,
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      effectiveLayer: "admin",
      source: "ownership",
      jobRoles: ["Waiter"],
      canEnterBusiness: true,
    });
  });

  it("resolves a manager member to manager without needing a schedule", async () => {
    const app = await getTestApp();
    const business = await createTestBusiness({
      tradeName: "Manager Venue",
      currencyTrade: "EUR",
    });
    const { userId, auth } = await createSignedInUser();
    await createMembership({
      businessId: business._id.toString(),
      userId,
      roles: ["Manager"],
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/business/${business._id}/access`,
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      businessId: business._id.toString(),
      effectiveLayer: "manager",
      source: "membership",
      jobRoles: ["Manager"],
      capabilities: [...SERVICE_FLOOR_CAPABILITIES, ...OPS_CAPABILITIES],
      canEnterBusiness: true,
    });
  });

  it("resolves the highest default layer among several job roles", async () => {
    const app = await getTestApp();
    const business = await createTestBusiness({
      tradeName: "Multi Role Venue",
      currencyTrade: "EUR",
    });
    const { userId, auth } = await createSignedInUser();
    await createMembership({
      businessId: business._id.toString(),
      userId,
      roles: ["Waiter", "Manager"],
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/business/${business._id}/access`,
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      effectiveLayer: "manager",
      source: "membership",
      jobRoles: ["Waiter", "Manager"],
    });
  });

  it("reports an employee outside the entry window as successful but not enterable", async () => {
    const app = await getTestApp();
    const business = await createTestBusiness({
      tradeName: "Employee Off Window Venue",
      currencyTrade: "EUR",
    });
    const { userId, auth } = await createSignedInUser();
    const employee = await createMembership({
      businessId: business._id.toString(),
      userId,
      roles: ["Waiter"],
    });
    await addShift({
      businessId: business._id.toString(),
      employeeId: employee._id,
      start: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/business/${business._id}/access`,
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      businessId: business._id.toString(),
      effectiveLayer: "employee",
      source: "membership",
      jobRoles: ["Waiter"],
      capabilities: [],
      canEnterBusiness: false,
    });
  });

  it("lets an employee enter inside the entry window", async () => {
    const app = await getTestApp();
    const business = await createTestBusiness({
      tradeName: "Employee In Window Venue",
      currencyTrade: "EUR",
    });
    const { userId, auth } = await createSignedInUser();
    const employee = await createMembership({
      businessId: business._id.toString(),
      userId,
      roles: ["Waiter"],
    });
    await addShift({
      businessId: business._id.toString(),
      employeeId: employee._id,
      start: new Date(Date.now() - 30 * 60 * 1000),
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/business/${business._id}/access`,
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      effectiveLayer: "employee",
      canEnterBusiness: true,
    });
  });

  it("gives a supervisor inside the window the service defaults without manager capabilities", async () => {
    const app = await getTestApp();
    const business = await createTestBusiness({
      tradeName: "Supervisor Venue",
      currencyTrade: "EUR",
    });
    const { userId, auth } = await createSignedInUser();
    const employee = await createMembership({
      businessId: business._id.toString(),
      userId,
      roles: ["Supervisor"],
    });
    await addShift({
      businessId: business._id.toString(),
      employeeId: employee._id,
      start: new Date(Date.now() - 30 * 60 * 1000),
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/business/${business._id}/access`,
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({
      effectiveLayer: "supervisor",
      source: "membership",
      canEnterBusiness: true,
      capabilities: [...SERVICE_FLOOR_CAPABILITIES],
    });
    for (const managerCapability of OPS_CAPABILITIES) {
      expect(body.capabilities).not.toContain(managerCapability);
    }
  });

  it("refuses a non-owner without an active membership", async () => {
    const app = await getTestApp();
    const business = await createTestBusiness({
      tradeName: "Outsider Venue",
      currencyTrade: "EUR",
    });
    const { auth } = await createSignedInUser();

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/business/${business._id}/access`,
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(403);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
  });

  it.each([
    ["inactive", { active: false }],
    ["terminated", { terminated: true }],
    ["soft-deleted", { deleted: true }],
  ])("refuses an %s membership", async (_label, membershipState) => {
    const app = await getTestApp();
    const business = await createTestBusiness({
      tradeName: "Blocked Membership Venue",
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
      url: `/api/v1/business/${business._id}/access`,
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(403);
  });

  it("requires authentication", async () => {
    const app = await getTestApp();
    const business = await createTestBusiness({
      tradeName: "Anonymous Venue",
      currencyTrade: "EUR",
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/business/${business._id}/access`,
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
  });

  it("rejects an invalid Business id as a validation problem", async () => {
    const app = await getTestApp();
    const { auth } = await createSignedInUser();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/business/not-an-object-id/access",
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(response.json()).toMatchObject({
      type: "https://restaurant-pos.app/errors/validation",
      status: 400,
      errors: [{ path: "businessId" }],
    });
  });
});

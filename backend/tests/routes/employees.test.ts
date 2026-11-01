/**
 * Employees Routes Tests — Phase 1.5 membership read rail.
 *
 * Access and error responses are asserted at the HTTP seam: failures are RFC
 * 9457 `application/problem+json` documents, never `{ message }`. The suite
 * covers the removed cross-tenant list, authentication on every membership
 * route, the shared manager layer gate, manager list identity rows, manager
 * full reads, the non-sensitive self-view, management contacts, and the
 * soft-delete retention path.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../src/cloudinary/deleteFolderCloudinary.ts", () => ({
  default: vi.fn(async () => true),
}));

import { Types } from "mongoose";
import { generateTestToken, getTestApp } from "../setup.ts";
import Employee from "../../src/models/employee.ts";
import User from "../../src/models/user.ts";
import Printer from "../../src/models/printer.ts";
import { multipart } from "../helpers/multipart.ts";
import {
  createTestBusiness,
  createTestOwnerCompany,
} from "../helpers/fixtures.ts";
import {
  detail,
  errorMessages,
  errorPaths,
  isProblemDetails,
} from "../helpers/problemDetails.ts";

const validAddress = {
  country: "USA",
  state: "CA",
  city: "Los Angeles",
  street: "Main St",
  buildingNumber: "123",
  postCode: "90001",
};

type TestActor = {
  userId: Types.ObjectId;
  email: string;
  auth: string;
};

type TestMember = TestActor & {
  employeeId: string;
  membership: Awaited<ReturnType<typeof Employee.create>>;
};

describe("Employees Routes", () => {
  let businessId: Types.ObjectId;
  let ownerUserId: Types.ObjectId;
  let ownerAuth: string;
  let targetUserId: Types.ObjectId;

  async function makeUser(
    firstName = "Test",
    lastName = "User",
  ): Promise<TestActor> {
    const userId = new Types.ObjectId();
    const email = `user-${userId}@test.com`;
    await User.create({
      _id: userId,
      personalDetails: { email, firstName, lastName },
    });
    const auth = await generateTestToken({
      id: userId.toString(),
      email,
      type: "user",
      role: "Customer",
    });
    return { userId, email, auth };
  }

  async function makeMember(params: {
    roles: string[];
    business?: Types.ObjectId;
    active?: boolean;
    terminatedDate?: Date | null;
    deleted?: boolean;
    firstName?: string;
    lastName?: string;
    employmentStatus?: string;
  }): Promise<TestMember> {
    const actor = await makeUser(
      params.firstName ?? "Member",
      params.lastName ?? "User",
    );
    const membership = await Employee.create({
      businessId: params.business ?? businessId,
      userId: actor.userId,
      allEmployeeRoles: params.roles,
      taxNumber: `EMP-${new Types.ObjectId()}`,
      joinDate: new Date("2024-01-15"),
      vacationDaysPerYear: 20,
      vacationDaysLeft: 12,
      contractHoursWeek: 32,
      salary: { payFrequency: "Hourly", grossSalary: 20, netSalary: 15 },
      comments: "HR-only note",
      documentsUrl: ["https://example.com/contract.pdf"],
      active: params.active ?? true,
      terminatedDate: params.terminatedDate,
      deleted: params.deleted ?? false,
      ...(params.deleted ? { deletedAt: new Date() } : {}),
    });

    if (params.employmentStatus) {
      await Employee.collection.updateOne(
        { _id: membership._id },
        { $set: { employmentStatus: params.employmentStatus } },
      );
    }

    return {
      ...actor,
      employeeId: membership._id.toString(),
      membership,
    };
  }

  const seedTargetUser = async () => {
    const user = await User.create({
      username: "employeeuser",
      email: "employeeuser@test.com",
      password: "hashedpassword",
      allUserRoles: ["employee"],
      personalDetails: {
        username: "employeeuser",
        email: "employeeuser@test.com",
        password: "hashedpassword",
        firstName: "Test",
        lastName: "User",
        phoneNumber: "1234567890",
        birthDate: new Date("1990-01-01"),
        gender: "Man",
        nationality: "USA",
        idType: "National ID",
        idNumber: "123456789",
        address: validAddress,
      },
    });
    targetUserId = user._id;
  };

  beforeEach(async () => {
    const owner = await createTestOwnerCompany();
    ownerUserId = owner.user._id;
    ownerAuth = await generateTestToken({
      id: ownerUserId.toString(),
      email: `owner-${ownerUserId}@test.com`,
      type: "user",
      role: "Customer",
    });

    const business = await createTestBusiness({
      companyId: owner.company._id,
      tradeName: "Test Restaurant",
      legalName: "Test Restaurant LLC",
      email: "test@restaurant.com",
      phoneNumber: "1234567890",
      taxNumber: `TAX-${new Types.ObjectId()}`,
      currencyTrade: "USD",
      address: validAddress,
    });
    businessId = business._id;

    await seedTargetUser();
  });

  const validCreateFields = () => ({
    allEmployeeRoles: JSON.stringify(["Waiter"]),
    employmentStatus: "Active",
    joinDate: "2024-01-15",
    businessId: businessId.toString(),
    userEmail: "employeeuser@test.com",
  });

  const validUpdateFields = () => {
    const {
      businessId: _omitBusinessId,
      userEmail: _omitUserEmail,
      ...rest
    } = validCreateFields();
    return rest;
  };

  describe("authentication on every membership route", () => {
    it("refuses unauthenticated reads of the venue membership list", async () => {
      const app = await getTestApp();
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/business/${businessId}`,
      });

      expect(response.statusCode).toBe(401);
      expect(isProblemDetails(response)).toBe(true);
    });

    it("refuses unauthenticated reads of management contacts", async () => {
      const app = await getTestApp();
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/business/${businessId}/management-contacts`,
      });

      expect(response.statusCode).toBe(401);
      expect(isProblemDetails(response)).toBe(true);
    });

    it("refuses unauthenticated reads of one membership", async () => {
      const app = await getTestApp();
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/${new Types.ObjectId()}`,
      });

      expect(response.statusCode).toBe(401);
      expect(isProblemDetails(response)).toBe(true);
    });

    it("refuses unauthenticated membership creation", async () => {
      const app = await getTestApp();
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/employees",
        payload: multipart(validCreateFields()),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(401);
      expect(isProblemDetails(response)).toBe(true);
    });

    it("refuses unauthenticated membership edits", async () => {
      const app = await getTestApp();
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/employees/${new Types.ObjectId()}`,
        payload: multipart(validUpdateFields()),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(401);
      expect(isProblemDetails(response)).toBe(true);
    });

    it("refuses unauthenticated membership deletion", async () => {
      const app = await getTestApp();
      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/employees/${new Types.ObjectId()}`,
      });

      expect(response.statusCode).toBe(401);
      expect(isProblemDetails(response)).toBe(true);
    });

    it("no longer exposes the cross-tenant all-employees list", async () => {
      const app = await getTestApp();
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/employees",
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
    });
  });

  describe("GET /api/v1/employees/business/:businessId", () => {
    it("lets an owner list the venue memberships", async () => {
      await makeMember({ roles: ["Waiter"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/business/${businessId}`,
        headers: { authorization: ownerAuth },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveLength(1);
    });

    it("lets a manager list memberships with the linked User name and email", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const employee = await makeMember({
        roles: ["Waiter"],
        firstName: "Alice",
        lastName: "Smith",
      });
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/business/${businessId}`,
        headers: { authorization: manager.auth },
      });

      expect(response.statusCode).toBe(200);
      const rows = response.json() as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(2);
      const alice = rows.find((row) => row._id === employee.employeeId);
      expect(alice).toMatchObject({
        displayName: "Alice Smith",
        email: employee.email,
      });
    });

    it("keeps soft-deleted memberships out unless includeDeleted is requested", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      await makeMember({ roles: ["Waiter"], deleted: true });
      const app = await getTestApp();

      const ordinary = await app.inject({
        method: "GET",
        url: `/api/v1/employees/business/${businessId}`,
        headers: { authorization: manager.auth },
      });
      expect(ordinary.statusCode).toBe(200);
      expect(ordinary.json()).toHaveLength(1);

      const withDeleted = await app.inject({
        method: "GET",
        url: `/api/v1/employees/business/${businessId}?includeDeleted=true`,
        headers: { authorization: manager.auth },
      });
      expect(withDeleted.statusCode).toBe(200);
      const rows = withDeleted.json() as Array<{ deleted?: boolean }>;
      expect(rows).toHaveLength(2);
      expect(rows.some((row) => row.deleted === true)).toBe(true);
    });

    it("does not list another venue's memberships", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const otherBusiness = await createTestBusiness({
        tradeName: "Other Venue",
        legalName: "Other Venue LLC",
        email: "other@restaurant.com",
        phoneNumber: "1234567890",
        taxNumber: `TAX-${new Types.ObjectId()}`,
        currencyTrade: "USD",
        address: validAddress,
      });
      const otherEmployee = await makeMember({
        roles: ["Waiter"],
        business: otherBusiness._id,
      });
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/business/${businessId}`,
        headers: { authorization: manager.auth },
      });

      expect(response.statusCode).toBe(200);
      const rows = response.json() as Array<{ _id: string }>;
      expect(rows.map((row) => row._id)).toEqual([manager.employeeId]);
      expect(rows.map((row) => row._id)).not.toContain(otherEmployee.employeeId);
    });

    it("returns an empty list for a venue with no memberships", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/business/${businessId}`,
        headers: { authorization: ownerAuth },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    });

    it("refuses a supervisor", async () => {
      const supervisor = await makeMember({ roles: ["Supervisor"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/business/${businessId}`,
        headers: { authorization: supervisor.auth },
      });

      expect(response.statusCode).toBe(403);
      expect(isProblemDetails(response)).toBe(true);
    });

    it("refuses an ordinary employee", async () => {
      const employee = await makeMember({ roles: ["Waiter"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/business/${businessId}`,
        headers: { authorization: employee.auth },
      });

      expect(response.statusCode).toBe(403);
      expect(isProblemDetails(response)).toBe(true);
    });

    it("refuses an outsider", async () => {
      const outsider = await makeUser();
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/business/${businessId}`,
        headers: { authorization: outsider.auth },
      });

      expect(response.statusCode).toBe(403);
      expect(isProblemDetails(response)).toBe(true);
    });

    it("returns validation Problem Details for an invalid includeDeleted value", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/business/${businessId}?includeDeleted=maybe`,
        headers: { authorization: manager.auth },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("includeDeleted");
    });
  });

  describe("GET /api/v1/employees/:employeeId", () => {
    it("returns the full manager-visible record to a manager", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const employee = await makeMember({ roles: ["Waiter"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/${employee.employeeId}`,
        headers: { authorization: manager.auth },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        _id: employee.employeeId,
        taxNumber: expect.any(String),
        salary: { payFrequency: "Hourly", grossSalary: 20, netSalary: 15 },
        comments: "HR-only note",
        documentsUrl: ["https://example.com/contract.pdf"],
      });
    });

    it("returns the full record to the owning User", async () => {
      const employee = await makeMember({ roles: ["Waiter"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/${employee.employeeId}`,
        headers: { authorization: ownerAuth },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        taxNumber: expect.any(String),
        salary: { grossSalary: 20 },
        comments: "HR-only note",
      });
    });

    it("returns only the non-sensitive self-view to the membership's own User", async () => {
      const employee = await makeMember({
        roles: ["Waiter"],
        employmentStatus: "Active",
      });
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/${employee.employeeId}`,
        headers: { authorization: employee.auth },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body).toMatchObject({
        _id: employee.employeeId,
        businessId: businessId.toString(),
        allEmployeeRoles: ["Waiter"],
        contractHoursWeek: 32,
        vacationDaysPerYear: 20,
        vacationDaysLeft: 12,
        documentsUrl: ["https://example.com/contract.pdf"],
        employmentStatus: "Active",
      });

      for (const key of [
        "salary",
        "taxNumber",
        "comments",
        "nationalIdNumber",
        "idNumber",
        "deleted",
        "deletedAt",
        "deletedBy",
      ]) {
        expect(body).not.toHaveProperty(key);
      }
    });

    it("keeps the self-view available outside a planned shift window", async () => {
      const employee = await makeMember({ roles: ["Waiter"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/${employee.employeeId}`,
        headers: { authorization: employee.auth },
      });

      expect(response.statusCode).toBe(200);
    });

    it.each([
      ["inactive", { active: false }],
      ["terminated", { terminatedDate: new Date("2024-06-01") }],
      ["soft-deleted", { deleted: true }],
      ["suspended status", { employmentStatus: "Suspended" }],
      ["terminated status", { employmentStatus: "Terminated" }],
    ])("refuses a self-view for a %s membership", async (_label, overrides) => {
      const employee = await makeMember({ roles: ["Waiter"], ...overrides });
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/${employee.employeeId}`,
        headers: { authorization: employee.auth },
      });

      expect(response.statusCode).toBe(403);
      expect(isProblemDetails(response)).toBe(true);
    });

    it("refuses a manager from another venue", async () => {
      const employee = await makeMember({ roles: ["Waiter"] });
      const otherBusiness = await createTestBusiness({
        tradeName: "Other Venue",
        legalName: "Other Venue LLC",
        email: "other@restaurant.com",
        phoneNumber: "1234567890",
        taxNumber: `TAX-${new Types.ObjectId()}`,
        currencyTrade: "USD",
        address: validAddress,
      });
      const otherManager = await makeMember({
        roles: ["Manager"],
        business: otherBusiness._id,
      });
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/${employee.employeeId}`,
        headers: { authorization: otherManager.auth },
      });

      expect(response.statusCode).toBe(403);
      expect(isProblemDetails(response)).toBe(true);
    });

    it("refuses an ordinary employee reading a peer", async () => {
      const employee = await makeMember({ roles: ["Waiter"] });
      const peer = await makeMember({ roles: ["Waiter"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/${peer.employeeId}`,
        headers: { authorization: employee.auth },
      });

      expect(response.statusCode).toBe(403);
      expect(isProblemDetails(response)).toBe(true);
    });

    it("refuses a supervisor reading a peer", async () => {
      const supervisor = await makeMember({ roles: ["Supervisor"] });
      const peer = await makeMember({ roles: ["Waiter"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/${peer.employeeId}`,
        headers: { authorization: supervisor.auth },
      });

      expect(response.statusCode).toBe(403);
      expect(isProblemDetails(response)).toBe(true);
    });

    it("refuses an outsider", async () => {
      const outsider = await makeUser();
      const employee = await makeMember({ roles: ["Waiter"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/${employee.employeeId}`,
        headers: { authorization: outsider.auth },
      });

      expect(response.statusCode).toBe(403);
      expect(isProblemDetails(response)).toBe(true);
    });

    it("returns validation Problem Details for an invalid id", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/employees/invalid-id",
        headers: { authorization: manager.auth },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("employeeId");
    });

    it("returns a problem-details 404 for a non-existent membership", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/${new Types.ObjectId()}`,
        headers: { authorization: manager.auth },
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("Employee not found!");
    });

    it("hides a soft-deleted membership from ordinary manager reads but shows it with includeDeleted", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const deleted = await makeMember({ roles: ["Waiter"], deleted: true });
      const app = await getTestApp();

      const ordinary = await app.inject({
        method: "GET",
        url: `/api/v1/employees/${deleted.employeeId}`,
        headers: { authorization: manager.auth },
      });
      expect(ordinary.statusCode).toBe(404);
      expect(isProblemDetails(ordinary)).toBe(true);

      const withDeleted = await app.inject({
        method: "GET",
        url: `/api/v1/employees/${deleted.employeeId}?includeDeleted=true`,
        headers: { authorization: manager.auth },
      });
      expect(withDeleted.statusCode).toBe(200);
      expect(withDeleted.json()).toMatchObject({ deleted: true });
    });
  });

  describe("GET /api/v1/employees/business/:businessId/management-contacts", () => {
    it("returns manager-and-above contacts and excludes Supervisor", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const ownerMember = await makeMember({ roles: ["Owner"] });
      const supervisor = await makeMember({ roles: ["Supervisor"] });
      const waiter = await makeMember({ roles: ["Waiter"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/business/${businessId}/management-contacts`,
        headers: { authorization: manager.auth },
      });

      expect(response.statusCode).toBe(200);
      const contacts = response.json() as Array<{ employeeId: string }>;
      const ids = contacts.map((contact) => contact.employeeId);
      expect(ids).toContain(manager.employeeId);
      expect(ids).toContain(ownerMember.employeeId);
      expect(ids).not.toContain(supervisor.employeeId);
      expect(ids).not.toContain(waiter.employeeId);
    });

    it("returns an empty list when only supervisors and employees exist", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      await makeMember({ roles: ["Supervisor"] });
      await makeMember({ roles: ["Waiter"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/business/${businessId}/management-contacts`,
        headers: { authorization: manager.auth },
      });

      expect(response.statusCode).toBe(200);
      const contacts = response.json() as Array<{ employeeId: string }>;
      expect(contacts.map((contact) => contact.employeeId)).toEqual([
        manager.employeeId,
      ]);
    });

    it.each([
      ["supervisor", ["Supervisor"]],
      ["employee", ["Waiter"]],
    ])("refuses a %s", async (_label, roles) => {
      const actor = await makeMember({ roles });
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/business/${businessId}/management-contacts`,
        headers: { authorization: actor.auth },
      });

      expect(response.statusCode).toBe(403);
      expect(isProblemDetails(response)).toBe(true);
    });

    it("refuses an outsider", async () => {
      const outsider = await makeUser();
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/employees/business/${businessId}/management-contacts`,
        headers: { authorization: outsider.auth },
      });

      expect(response.statusCode).toBe(403);
      expect(isProblemDetails(response)).toBe(true);
    });

    it("returns validation Problem Details for an invalid businessId", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/employees/business/invalid-id/management-contacts",
        headers: { authorization: manager.auth },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("businessId");
    });
  });

  describe("DELETE /api/v1/employees/:employeeId", () => {
    it("soft-deletes a membership for a manager", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const employee = await makeMember({ roles: ["Waiter"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/employees/${employee.employeeId}`,
        headers: { authorization: manager.auth },
      });

      expect(response.statusCode).toBe(200);

      const retained = await Employee.findById(employee.employeeId)
        .setOptions({ includeDeleted: true })
        .lean();
      expect(retained?.deleted).toBe(true);
      expect(retained?.deletedAt).toBeTruthy();
      expect(await Employee.findById(employee.employeeId).lean()).toBeNull();
    });

    it("soft-deletes a membership for the owning User", async () => {
      const employee = await makeMember({ roles: ["Waiter"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/employees/${employee.employeeId}`,
        headers: { authorization: ownerAuth },
      });

      expect(response.statusCode).toBe(200);
    });

    it.each([
      ["supervisor", ["Supervisor"]],
      ["employee", ["Waiter"]],
    ])("refuses a %s", async (_label, roles) => {
      const actor = await makeMember({ roles });
      const employee = await makeMember({ roles: ["Waiter"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/employees/${employee.employeeId}`,
        headers: { authorization: actor.auth },
      });

      expect(response.statusCode).toBe(403);
      expect(isProblemDetails(response)).toBe(true);
    });

    it("refuses an outsider and a manager from another venue", async () => {
      const outsider = await makeUser();
      const employee = await makeMember({ roles: ["Waiter"] });
      const app = await getTestApp();

      const outsiderResponse = await app.inject({
        method: "DELETE",
        url: `/api/v1/employees/${employee.employeeId}`,
        headers: { authorization: outsider.auth },
      });
      expect(outsiderResponse.statusCode).toBe(403);

      const otherBusiness = await createTestBusiness({
        tradeName: "Other Venue",
        legalName: "Other Venue LLC",
        email: "other@restaurant.com",
        phoneNumber: "1234567890",
        taxNumber: `TAX-${new Types.ObjectId()}`,
        currencyTrade: "USD",
        address: validAddress,
      });
      const otherManager = await makeMember({
        roles: ["Manager"],
        business: otherBusiness._id,
      });
      const otherResponse = await app.inject({
        method: "DELETE",
        url: `/api/v1/employees/${employee.employeeId}`,
        headers: { authorization: otherManager.auth },
      });
      expect(otherResponse.statusCode).toBe(403);
      expect(isProblemDetails(otherResponse)).toBe(true);
    });

    it("returns validation Problem Details for an invalid employeeId", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/employees/invalid-id",
        headers: { authorization: manager.auth },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("employeeId");
    });

    it("returns a problem-details 404 for a non-existent membership", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/employees/${new Types.ObjectId()}`,
        headers: { authorization: manager.auth },
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("Employee not found!");
    });

    it("returns a problem-details 409 for an already soft-deleted membership", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const deleted = await makeMember({ roles: ["Waiter"], deleted: true });
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/employees/${deleted.employeeId}`,
        headers: { authorization: manager.auth },
      });

      expect(response.statusCode).toBe(409);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("Employee already deleted!");
    });
  });

  describe("POST /api/v1/employees", () => {
    it("returns validation Problem Details for missing required fields", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/employees",
        payload: multipart({ taxNumber: "EMP-001" }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      for (const field of [
        "allEmployeeRoles",
        "employmentStatus",
        "joinDate",
        "businessId",
        "userEmail",
      ]) {
        expect(errorPaths(response), field).toContain(field);
      }
    });

    it("returns validation Problem Details for an invalid businessId", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/employees",
        payload: multipart({ ...validCreateFields(), businessId: "invalid-id" }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("businessId");
    });

    it("returns validation Problem Details for an invalid employee role", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/employees",
        payload: multipart({
          ...validCreateFields(),
          allEmployeeRoles: JSON.stringify(["InvalidRole"]),
        }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("allEmployeeRoles.0");
    });

    it("returns validation Problem Details for malformed JSON allEmployeeRoles", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/employees",
        payload: multipart({
          ...validCreateFields(),
          allEmployeeRoles: "{not json",
        }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorMessages(response)).toContain("Invalid JSON");
    });

    it("returns validation Problem Details for an invalid salary", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const app = await getTestApp();

      const missingField = await app.inject({
        method: "POST",
        url: "/api/v1/employees",
        payload: multipart({
          ...validCreateFields(),
          salary: JSON.stringify({ payFrequency: "Hourly", grossSalary: 20 }),
        }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });

      expect(missingField.statusCode).toBe(400);
      expect(isProblemDetails(missingField)).toBe(true);
      expect(errorPaths(missingField)).toContain("salary.netSalary");

      const badFrequency = await app.inject({
        method: "POST",
        url: "/api/v1/employees",
        payload: multipart({
          ...validCreateFields(),
          salary: JSON.stringify({
            payFrequency: "Fortnightly",
            grossSalary: 20,
            netSalary: 15,
          }),
        }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });

      expect(badFrequency.statusCode).toBe(400);
      expect(isProblemDetails(badFrequency)).toBe(true);
      expect(errorMessages(badFrequency)).toContain("Invalid pay frequency!");
    });

    it("returns validation Problem Details for a server-owned field", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/employees",
        payload: multipart({
          ...validCreateFields(),
          documentsUrl: "https://example.com/doc.png",
        }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorMessages(response).some((m) => m.includes("documentsUrl"))).toBe(
        true,
      );
    });

    it("rejects a create with more files than the transport allows", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const app = await getTestApp();

      const form = multipart(validCreateFields());
      for (let i = 0; i < 11; i++) {
        form.append(
          "documents",
          new Blob([Buffer.from("data")], { type: "image/png" }),
          `doc-${i}.png`,
        );
      }

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/employees",
        payload: form,
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });

      expect(response.statusCode).toBe(413);
      expect(isProblemDetails(response)).toBe(true);
    });

    it("refuses a supervisor and an ordinary employee", async () => {
      const supervisor = await makeMember({ roles: ["Supervisor"] });
      const employee = await makeMember({ roles: ["Waiter"] });
      const app = await getTestApp();

      for (const actor of [supervisor, employee]) {
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/employees",
          payload: multipart(validCreateFields()),
          headers: {
            "content-type": "multipart/form-data",
            authorization: actor.auth,
          },
        });

        expect(response.statusCode).toBe(403);
        expect(isProblemDetails(response)).toBe(true);
      }
    });

    it("creates an employee membership for a manager", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/employees",
        payload: multipart(validCreateFields()),
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().message).toContain("created");

      const created = await Employee.findOne({
        businessId,
        userId: targetUserId,
      }).lean();
      expect(created).toMatchObject({
        allEmployeeRoles: ["Waiter"],
        employmentStatus: "Active",
        active: true,
      });
      expect(created?.taxNumber).toBeUndefined();
      expect(created?.vacationDaysPerYear).toBeUndefined();
    });

    it("prevents a duplicate membership for the same User and Business", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      await Employee.create({
        businessId,
        userId: targetUserId,
        allEmployeeRoles: ["Waiter"],
        taxNumber: `EMP-${new Types.ObjectId()}`,
        joinDate: new Date(),
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
      });
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/employees",
        payload: multipart(validCreateFields()),
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });

      expect(response.statusCode).toBe(409);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("User is already an employee!");
    });

    it("reactivates a soft-deleted membership instead of duplicating it", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const taxNumber = `EMP-${new Types.ObjectId()}`;
      const softDeleted = await Employee.create({
        businessId,
        userId: targetUserId,
        allEmployeeRoles: ["Cashier"],
        taxNumber,
        joinDate: new Date("2020-01-01"),
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
        comments: "Retained HR note",
        documentsUrl: ["https://example.com/retained.pdf"],
        employmentStatus: "Terminated",
        terminatedDate: new Date("2021-01-01"),
        deleted: true,
        deletedAt: new Date(),
      });
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/employees",
        payload: multipart({
          ...validCreateFields(),
          allEmployeeRoles: JSON.stringify(["Supervisor"]),
          employmentStatus: "Suspended",
          joinDate: "2024-03-01",
        }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });

      expect(response.statusCode).toBe(201);
      expect(
        await Employee.countDocuments({ businessId, userId: targetUserId }),
      ).toBe(1);

      const reactivated = await Employee.findById(softDeleted._id).lean();
      expect(reactivated).toMatchObject({
        _id: softDeleted._id,
        allEmployeeRoles: ["Supervisor"],
        employmentStatus: "Suspended",
        active: false,
        deleted: false,
      });
      expect(reactivated?.joinDate).toEqual(new Date("2024-03-01"));
      expect(reactivated?.terminatedDate).toBeUndefined();
      expect(reactivated?.deletedAt).toBeUndefined();
      expect(reactivated?.deletedBy).toBeUndefined();
      expect(reactivated).toMatchObject({
        taxNumber,
        comments: "Retained HR note",
        documentsUrl: ["https://example.com/retained.pdf"],
        vacationDaysPerYear: 20,
      });
    });

    it("applies the edit bound when reactivating a soft-deleted membership", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const admin = await makeMember({ roles: ["Admin"] });
      await Employee.create({
        businessId,
        userId: targetUserId,
        allEmployeeRoles: ["Manager"],
        joinDate: new Date("2024-01-15"),
        deleted: true,
        deletedAt: new Date(),
      });
      const app = await getTestApp();

      const managerResponse = await app.inject({
        method: "POST",
        url: "/api/v1/employees",
        payload: multipart(validCreateFields()),
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });
      expect(managerResponse.statusCode).toBe(403);
      expect(isProblemDetails(managerResponse)).toBe(true);

      const adminResponse = await app.inject({
        method: "POST",
        url: "/api/v1/employees",
        payload: multipart(validCreateFields()),
        headers: {
          "content-type": "multipart/form-data",
          authorization: admin.auth,
        },
      });
      expect(adminResponse.statusCode).toBe(201);
    });

    it("allows the same User to belong to more than one Business", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const secondBusiness = await createTestBusiness({
        tradeName: "Second Restaurant",
        legalName: "Second Restaurant LLC",
        email: "second@restaurant.com",
        phoneNumber: "1234567890",
        taxNumber: `TAX-${new Types.ObjectId()}`,
        currencyTrade: "USD",
        address: validAddress,
      });
      const secondManager = await makeMember({
        roles: ["Manager"],
        business: secondBusiness._id,
      });
      const app = await getTestApp();

      const first = await app.inject({
        method: "POST",
        url: "/api/v1/employees",
        payload: multipart(validCreateFields()),
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });
      expect(first.statusCode).toBe(201);

      const second = await app.inject({
        method: "POST",
        url: "/api/v1/employees",
        payload: multipart({
          ...validCreateFields(),
          businessId: secondBusiness._id.toString(),
        }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: secondManager.auth,
        },
      });
      expect(second.statusCode).toBe(201);

      expect(await Employee.countDocuments({ userId: targetUserId })).toBe(2);
    });

    it("returns not found when the hire email has no active User", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/employees",
        payload: multipart({
          ...validCreateFields(),
          userEmail: "missing@test.com",
        }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("User does not exist!");
    });

    it("refuses a new membership that starts Terminated", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/employees",
        payload: multipart({
          ...validCreateFields(),
          employmentStatus: "Terminated",
        }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("A new membership cannot start Terminated!");
    });

    it.each([
      ["Suspended", false],
      ["Seasonal", true],
      ["Medical absence", true],
      ["Parental leave", true],
      ["Unpaid leave", true],
    ])(
      "accepts %s on create and derives active as %s",
      async (employmentStatus, expectedActive) => {
        const manager = await makeMember({ roles: ["Manager"] });
        const app = await getTestApp();

        const response = await app.inject({
          method: "POST",
          url: "/api/v1/employees",
          payload: multipart({ ...validCreateFields(), employmentStatus }),
          headers: {
            "content-type": "multipart/form-data",
            authorization: manager.auth,
          },
        });

        expect(response.statusCode).toBe(201);

        const created = await Employee.findOne({
          businessId,
          userId: targetUserId,
        }).lean();
        expect(created).toMatchObject({
          employmentStatus,
          active: expectedActive,
        });
      },
    );

    it("applies the actor's role assignment bounds when hiring", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const admin = await makeMember({ roles: ["Admin"] });
      const app = await getTestApp();

      const hire = async (auth: string, roles: string[]) => {
        const target = await makeUser();
        return app.inject({
          method: "POST",
          url: "/api/v1/employees",
          payload: multipart({
            ...validCreateFields(),
            userEmail: target.email,
            allEmployeeRoles: JSON.stringify(roles),
          }),
          headers: {
            "content-type": "multipart/form-data",
            authorization: auth,
          },
        });
      };

      expect((await hire(manager.auth, ["Manager"])).statusCode).toBe(403);
      expect((await hire(manager.auth, ["Admin"])).statusCode).toBe(403);
      expect((await hire(admin.auth, ["Owner"])).statusCode).toBe(403);
      expect((await hire(admin.auth, ["Admin"])).statusCode).toBe(403);
      expect((await hire(admin.auth, ["Manager"])).statusCode).toBe(201);
      expect((await hire(ownerAuth, ["Owner"])).statusCode).toBe(201);
    });

    it("persists optional legacy HR fields when a hire provides them", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const app = await getTestApp();
      const taxNumber = `EMP-${new Types.ObjectId()}`;

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/employees",
        payload: multipart({
          ...validCreateFields(),
          taxNumber,
          vacationDaysPerYear: "20",
          contractHoursWeek: "32",
          salary: JSON.stringify({
            payFrequency: "Hourly",
            grossSalary: 20,
            netSalary: 15,
          }),
          comments: "HR-only note",
        }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });

      expect(response.statusCode).toBe(201);

      const created = await Employee.findOne({
        businessId,
        userId: targetUserId,
      }).lean();
      expect(created).toMatchObject({
        taxNumber,
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
        contractHoursWeek: 32,
        salary: { payFrequency: "Hourly", grossSalary: 20, netSalary: 15 },
        comments: "HR-only note",
      });
    });

    it("cannot create two non-deleted memberships from concurrent duplicate hires", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const app = await getTestApp();

      const submit = () =>
        app.inject({
          method: "POST",
          url: "/api/v1/employees",
          payload: multipart(validCreateFields()),
          headers: {
            "content-type": "multipart/form-data",
            authorization: manager.auth,
          },
        });

      const responses = await Promise.all([submit(), submit()]);

      expect(
        await Employee.countDocuments({ businessId, userId: targetUserId }),
      ).toBe(1);
      expect(
        responses.map((response) => response.statusCode).sort(),
      ).toEqual([201, 409]);
      const conflictResponse = responses.find(
        (response) => response.statusCode === 409,
      );
      expect(conflictResponse).toBeDefined();
      expect(isProblemDetails(conflictResponse!)).toBe(true);
    });
  });

  describe("PATCH /api/v1/employees/:employeeId", () => {
    it("returns validation Problem Details for an invalid employeeId", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/employees/invalid-id",
        payload: multipart(validUpdateFields()),
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("employeeId");
    });

    it("returns validation Problem Details for missing required fields", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const employee = await Employee.create({
        businessId,
        userId: targetUserId,
        allEmployeeRoles: ["Waiter"],
        taxNumber: `EMP-${new Types.ObjectId()}`,
        joinDate: new Date(),
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
      });
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/employees/${employee._id}`,
        payload: multipart({ taxNumber: "EMP-UPDATED" }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("joinDate");
    });

    it("returns validation Problem Details when terminatedDate is before joinDate", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const employee = await Employee.create({
        businessId,
        userId: targetUserId,
        allEmployeeRoles: ["Waiter"],
        taxNumber: `EMP-${new Types.ObjectId()}`,
        joinDate: new Date("2024-06-01"),
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
      });
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/employees/${employee._id}`,
        payload: multipart({
          ...validUpdateFields(),
          employmentStatus: "Terminated",
          joinDate: "2024-06-01",
          terminatedDate: "2024-01-01",
        }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe(
        "Terminate date must be on or after join date!",
      );
    });

    it("returns validation Problem Details for too many documents", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const employee = await Employee.create({
        businessId,
        userId: targetUserId,
        allEmployeeRoles: ["Waiter"],
        taxNumber: `EMP-${new Types.ObjectId()}`,
        joinDate: new Date(),
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
        documentsUrl: Array.from(
          { length: 10 },
          (_, i) => `https://example.com/doc-${i}.png`,
        ),
      });
      const app = await getTestApp();

      const form = multipart(validUpdateFields());
      form.append(
        "documents",
        new Blob([Buffer.from("data")], { type: "image/png" }),
        "extra.png",
      );

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/employees/${employee._id}`,
        payload: form,
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("Max file quantity is 10!");
    });

    it("refuses a supervisor and an ordinary employee edit", async () => {
      const supervisor = await makeMember({ roles: ["Supervisor"] });
      const employee = await makeMember({ roles: ["Waiter"] });
      const target = await Employee.create({
        businessId,
        userId: targetUserId,
        allEmployeeRoles: ["Waiter"],
        taxNumber: `EMP-${new Types.ObjectId()}`,
        joinDate: new Date(),
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
      });
      const app = await getTestApp();

      for (const actor of [supervisor, employee]) {
        const response = await app.inject({
          method: "PATCH",
          url: `/api/v1/employees/${target._id}`,
          payload: multipart(validUpdateFields()),
          headers: {
            "content-type": "multipart/form-data",
            authorization: actor.auth,
          },
        });

        expect(response.statusCode).toBe(403);
        expect(isProblemDetails(response)).toBe(true);
      }
    });

    it("updates an employee and syncs the printer when the status blocks access", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const employee = await Employee.create({
        businessId,
        userId: targetUserId,
        allEmployeeRoles: ["Waiter"],
        taxNumber: `EMP-${new Types.ObjectId()}`,
        joinDate: new Date("2024-01-15"),
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
        employmentStatus: "Active",
      });
      const printer = await Printer.create({
        businessId,
        printerAlias: "Test Printer",
        ipAddress: "192.168.1.100",
        port: 9100,
        employeesAllowedToPrintDataIds: [employee._id],
      });
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/employees/${employee._id}`,
        payload: multipart({
          ...validUpdateFields(),
          employmentStatus: "Suspended",
        }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().message).toContain("updated");

      const updatedEmployee = await Employee.findById(employee._id).lean();
      expect(updatedEmployee?.active).toBe(false);

      const updatedPrinter = await Printer.findById(printer._id).lean();
      expect(updatedPrinter?.employeesAllowedToPrintDataIds).not.toContain(
        employee._id.toString(),
      );
    });

    it("requires a termination date when moving to Terminated", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const employee = await makeMember({ roles: ["Waiter"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/employees/${employee.employeeId}`,
        payload: multipart({
          ...validUpdateFields(),
          employmentStatus: "Terminated",
        }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe(
        "Termination date is required for a terminated employee!",
      );
    });

    it("accepts a same-day termination and derives the inactive mirror", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const employee = await makeMember({ roles: ["Waiter"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/employees/${employee.employeeId}`,
        payload: multipart({
          ...validUpdateFields(),
          employmentStatus: "Terminated",
          joinDate: "2024-01-15",
          terminatedDate: "2024-01-15",
        }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });

      expect(response.statusCode).toBe(200);

      const updated = await Employee.findById(employee.employeeId).lean();
      expect(updated).toMatchObject({
        employmentStatus: "Terminated",
        active: false,
      });
      expect(updated?.terminatedDate).toEqual(new Date("2024-01-15"));
    });

    it("clears the termination date when moving to a non-terminated status", async () => {
      const employee = await makeMember({
        roles: ["Waiter"],
        employmentStatus: "Terminated",
        terminatedDate: new Date("2024-06-01"),
      });
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/employees/${employee.employeeId}`,
        payload: multipart({
          ...validUpdateFields(),
          employmentStatus: "Active",
        }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: ownerAuth,
        },
      });

      expect(response.statusCode).toBe(200);

      const updated = await Employee.findById(employee.employeeId).lean();
      expect(updated).toMatchObject({
        employmentStatus: "Active",
        active: true,
      });
      expect(updated?.terminatedDate).toBeUndefined();
    });

    it("refuses a manager rehiring a terminated membership", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const employee = await makeMember({
        roles: ["Waiter"],
        employmentStatus: "Terminated",
        terminatedDate: new Date("2024-06-01"),
      });
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/employees/${employee.employeeId}`,
        payload: multipart({
          ...validUpdateFields(),
          employmentStatus: "Active",
        }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });

      expect(response.statusCode).toBe(403);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe(
        "Only an admin or owner can rehire a terminated membership!",
      );
    });

    it("lets an admin rehire the same membership row", async () => {
      const admin = await makeMember({ roles: ["Admin"] });
      const employee = await makeMember({
        roles: ["Waiter"],
        employmentStatus: "Terminated",
        terminatedDate: new Date("2024-06-01"),
      });
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/employees/${employee.employeeId}`,
        payload: multipart({
          ...validUpdateFields(),
          employmentStatus: "Active",
        }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: admin.auth,
        },
      });

      expect(response.statusCode).toBe(200);

      expect(
        await Employee.countDocuments({ businessId, userId: employee.userId }),
      ).toBe(1);
      const updated = await Employee.findById(employee.employeeId).lean();
      expect(updated?._id.toString()).toBe(employee.employeeId);
      expect(updated).toMatchObject({
        employmentStatus: "Active",
        active: true,
      });
      expect(updated?.terminatedDate).toBeUndefined();
    });

    it("refuses a manager promoting a member to a manager role", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const employee = await makeMember({ roles: ["Waiter"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/employees/${employee.employeeId}`,
        payload: multipart({
          ...validUpdateFields(),
          allEmployeeRoles: JSON.stringify(["Manager"]),
        }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });

      expect(response.statusCode).toBe(403);
      expect(isProblemDetails(response)).toBe(true);
    });

    it("refuses an admin assigning Owner/Admin and allows a manager role", async () => {
      const admin = await makeMember({ roles: ["Admin"] });
      const employee = await makeMember({ roles: ["Waiter"] });
      const app = await getTestApp();

      for (const role of ["Owner", "Admin"]) {
        const response = await app.inject({
          method: "PATCH",
          url: `/api/v1/employees/${employee.employeeId}`,
          payload: multipart({
            ...validUpdateFields(),
            allEmployeeRoles: JSON.stringify([role]),
          }),
          headers: {
            "content-type": "multipart/form-data",
            authorization: admin.auth,
          },
        });

        expect(response.statusCode, role).toBe(403);
        expect(isProblemDetails(response)).toBe(true);
      }

      const promoted = await app.inject({
        method: "PATCH",
        url: `/api/v1/employees/${employee.employeeId}`,
        payload: multipart({
          ...validUpdateFields(),
          allEmployeeRoles: JSON.stringify(["Manager"]),
        }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: admin.auth,
        },
      });
      expect(promoted.statusCode).toBe(200);
    });

    it("lets the owning User assign Owner", async () => {
      const employee = await makeMember({ roles: ["Waiter"] });
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/employees/${employee.employeeId}`,
        payload: multipart({
          ...validUpdateFields(),
          allEmployeeRoles: JSON.stringify(["Owner"]),
        }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: ownerAuth,
        },
      });

      expect(response.statusCode).toBe(200);

      const updated = await Employee.findById(employee.employeeId).lean();
      expect(updated?.allEmployeeRoles).toEqual(["Owner"]);
    });

    it("refuses editing a membership at or above the actor's layer", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const peerManager = await makeMember({ roles: ["Manager"] });
      const admin = await makeMember({ roles: ["Admin"] });
      const peerAdmin = await makeMember({ roles: ["Admin"] });
      const app = await getTestApp();

      const managerEdit = await app.inject({
        method: "PATCH",
        url: `/api/v1/employees/${peerManager.employeeId}`,
        payload: multipart({
          ...validUpdateFields(),
          allEmployeeRoles: JSON.stringify(["Waiter"]),
        }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });
      expect(managerEdit.statusCode).toBe(403);
      expect(isProblemDetails(managerEdit)).toBe(true);

      const adminEdit = await app.inject({
        method: "PATCH",
        url: `/api/v1/employees/${peerAdmin.employeeId}`,
        payload: multipart(validUpdateFields()),
        headers: {
          "content-type": "multipart/form-data",
          authorization: admin.auth,
        },
      });
      expect(adminEdit.statusCode).toBe(403);
      expect(isProblemDetails(adminEdit)).toBe(true);

      const ownerEdit = await app.inject({
        method: "PATCH",
        url: `/api/v1/employees/${peerAdmin.employeeId}`,
        payload: multipart(validUpdateFields()),
        headers: {
          "content-type": "multipart/form-data",
          authorization: ownerAuth,
        },
      });
      expect(ownerEdit.statusCode).toBe(200);
    });

    it("cannot change the Business or rebind the User on update", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const employee = await makeMember({ roles: ["Waiter"] });
      const app = await getTestApp();

      for (const field of ["businessId", "userEmail", "active"]) {
        const response = await app.inject({
          method: "PATCH",
          url: `/api/v1/employees/${employee.employeeId}`,
          payload: multipart({
            ...validUpdateFields(),
            [field]: field === "businessId" ? businessId.toString() : "x",
          }),
          headers: {
            "content-type": "multipart/form-data",
            authorization: manager.auth,
          },
        });

        expect(response.statusCode, field).toBe(400);
        expect(isProblemDetails(response)).toBe(true);
      }

      const unchanged = await Employee.findById(employee.employeeId).lean();
      expect(unchanged?.businessId?.toString()).toBe(businessId.toString());
      expect(unchanged?.userId?.toString()).toBe(employee.userId.toString());
    });

    it("sets optional legacy HR fields on update", async () => {
      const manager = await makeMember({ roles: ["Manager"] });
      const employee = await makeMember({ roles: ["Waiter"] });
      const app = await getTestApp();
      const taxNumber = `EMP-${new Types.ObjectId()}`;

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/employees/${employee.employeeId}`,
        payload: multipart({
          ...validUpdateFields(),
          taxNumber,
          vacationDaysPerYear: "25",
          contractHoursWeek: "40",
          salary: JSON.stringify({
            payFrequency: "Monthly",
            grossSalary: 3000,
            netSalary: 2400,
          }),
          comments: "Updated HR note",
        }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: manager.auth,
        },
      });

      expect(response.statusCode).toBe(200);

      const updated = await Employee.findById(employee.employeeId).lean();
      expect(updated).toMatchObject({
        taxNumber,
        vacationDaysPerYear: 25,
        contractHoursWeek: 40,
        salary: {
          payFrequency: "Monthly",
          grossSalary: 3000,
          netSalary: 2400,
        },
        comments: "Updated HR note",
      });
    });
  });

  /**
   * Cloudinary integration tests call the real API and require credentials.
   */
  const hasCloudinaryCredentials = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );

  describe.skipIf(!hasCloudinaryCredentials)(
    "Cloudinary Integration - POST /api/v1/employees",
    () => {
      it("creates employee with document uploads", async () => {
        const manager = await makeMember({ roles: ["Manager"] });
        const app = await getTestApp();
        const pngBuffer = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
          "base64",
        );

        const form = multipart(validCreateFields());
        form.append(
          "documents",
          new Blob([pngBuffer], { type: "image/png" }),
          "test-doc.png",
        );

        const response = await app.inject({
          method: "POST",
          url: "/api/v1/employees",
          payload: form,
          headers: {
            "content-type": "multipart/form-data",
            authorization: manager.auth,
          },
        });

        expect(response.statusCode).toBe(201);

        const created = await Employee.findOne({
          businessId,
          userId: targetUserId,
        }).lean();
        expect(created?.documentsUrl?.[0]).toContain("cloudinary.com");
      });
    },
  );

  describe.skipIf(!hasCloudinaryCredentials)(
    "Cloudinary Integration - PATCH /api/v1/employees/:employeeId",
    () => {
      it("updates employee with additional document uploads", async () => {
        const manager = await makeMember({ roles: ["Manager"] });
        const taxNumber = `EMP-PATCH-${Date.now()}`;
        const employee = await Employee.create({
          businessId,
          userId: targetUserId,
          allEmployeeRoles: ["Waiter"],
          taxNumber,
          joinDate: new Date(),
          vacationDaysPerYear: 20,
          vacationDaysLeft: 20,
          documentsUrl: ["https://existing-doc.com/file.png"],
        });
        const app = await getTestApp();
        const pngBuffer = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
          "base64",
        );

        const form = multipart({
          ...validUpdateFields(),
          taxNumber,
        });
        form.append(
          "documents",
          new Blob([pngBuffer], { type: "image/png" }),
          "additional-doc.png",
        );

        const response = await app.inject({
          method: "PATCH",
          url: `/api/v1/employees/${employee._id}`,
          payload: form,
          headers: {
            "content-type": "multipart/form-data",
            authorization: manager.auth,
          },
        });

        expect(response.statusCode).toBe(200);

        const updated = await Employee.findById(employee._id).lean();
        expect(updated?.documentsUrl?.length).toBe(2);
        expect(
          updated?.documentsUrl?.some((url: string) =>
            url.includes("cloudinary.com"),
          ),
        ).toBe(true);
      });
    },
  );

  describe.skipIf(!hasCloudinaryCredentials)(
    "Cloudinary Integration - DELETE /api/v1/employees/:employeeId",
    () => {
      it("deletes employee and keeps the soft-deleted record", async () => {
        const manager = await makeMember({ roles: ["Manager"] });
        const app = await getTestApp();
        const pngBuffer = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
          "base64",
        );

        const form = multipart(validCreateFields());
        form.append(
          "documents",
          new Blob([pngBuffer], { type: "image/png" }),
          "test-doc.png",
        );

        const createResponse = await app.inject({
          method: "POST",
          url: "/api/v1/employees",
          payload: form,
          headers: {
            "content-type": "multipart/form-data",
            authorization: manager.auth,
          },
        });
        expect(createResponse.statusCode).toBe(201);

        const employee = await Employee.findOne({
          businessId,
          userId: targetUserId,
        }).lean();
        expect(employee).not.toBeNull();

        const response = await app.inject({
          method: "DELETE",
          url: `/api/v1/employees/${employee?._id}`,
          headers: { authorization: manager.auth },
        });
        expect(response.statusCode).toBe(200);

        const deleted = await Employee.findById(employee?._id)
          .setOptions({ includeDeleted: true })
          .lean();
        expect(deleted?.deleted).toBe(true);
      });
    },
  );
});

/**
 * Business Routes Tests - Phase 1 Module 2
 * Tests for business CRUD endpoints
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Types } from "mongoose";
import { getTestApp, generateTestToken } from "../setup.ts";
import Business from "../../src/models/business.ts";
import Company from "../../src/models/company.ts";
import Owner from "../../src/models/owner.ts";
import User from "../../src/models/user.ts";
import Employee from "../../src/models/employee.ts";
import Notification from "../../src/models/notification.ts";
import emailChannel from "../../src/communications/channels/emailChannel.ts";
import {
  createTestBusiness,
  createTestOwnerCompany,
} from "../helpers/fixtures.ts";

vi.mock("../../src/cloudinary/deleteFolderCloudinary.ts", () => ({
  default: vi.fn().mockResolvedValue(true),
}));


/**
 * Mint a User session with an active Employee membership for the venue, so the
 * business routes authorize through the signed-in User's access seam.
 */
async function businessAccessToken(
  app: Awaited<ReturnType<typeof getTestApp>>,
  businessId: string,
): Promise<string> {
  const userId = new Types.ObjectId();
  await User.create({
    _id: userId,
    personalDetails: {
      email: `staff-${userId}@test.com`,
      firstName: "Venue",
      lastName: "Staff",
    },
  });
  const employee = await Employee.create({
    businessId,
    userId,
    allEmployeeRoles: ["Manager"],
    currentShiftRole: "Manager",
    taxNumber: `EMP-${new Types.ObjectId()}`,
    joinDate: new Date(),
    vacationDaysPerYear: 20,
    active: true,
  });
  return generateTestToken({
    id: userId.toString(),
    email: `staff-${userId}@test.com`,
    type: "user",
    role: "Manager",
    businessId,
    employeeId: employee._id.toString(),
    canLogAsEmployee: true,
  });
}

/**
 * Mint a User session that reaches the venue through User → Owner → Company →
 * Business, with no Employee membership.
 */
async function businessOwnerToken(
  userId: string,
  email: string,
): Promise<string> {
  return generateTestToken({
    id: userId,
    email,
    type: "user",
    role: "Customer",
  });
}

async function customerAuthToken(): Promise<{
  auth: string;
  userId: string;
}> {
  const userId = new Types.ObjectId();
  await User.create({
    _id: userId,
    personalDetails: {
      email: `customer-${userId}@test.com`,
      firstName: "Draft",
      lastName: "Owner",
    },
  });
  const auth = await generateTestToken({
    id: userId.toString(),
    email: `customer-${userId}@test.com`,
    type: "user",
    role: "Customer",
  });
  return { auth, userId: userId.toString() };
}

describe("Business Routes", () => {
  const validAddress = {
    country: "USA",
    state: "CA",
    city: "Los Angeles",
    street: "Main St",
    buildingNumber: "123",
    postCode: "90001",
  };

  describe("POST /api/v1/business", () => {
    const draft = {
      tradeName: "Draft Venue",
      currencyTrade: "USD",
      country: "USA",
    };

    it("requires authentication", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        payload: draft,
      });

      expect(response.statusCode).toBe(401);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      await expect(Business.countDocuments()).resolves.toBe(0);
    });

    it("creates a draft Business and the first venue's Owner and Company", async () => {
      const app = await getTestApp();
      const { auth, userId } = await customerAuthToken();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { authorization: auth },
        payload: draft,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.business).toMatchObject({
        tradeName: "Draft Venue",
        currencyTrade: "USD",
        address: { country: "USA" },
      });
      expect(body.business._id).toEqual(expect.any(String));
      expect(body.business.companyId).toBe(body.company._id);
      expect(body.business.address._id).toBeUndefined();
      expect(body.company).toMatchObject({ country: "USA" });
      expect(body.company.legalName).toBeUndefined();
      expect(body.company.taxNumber).toBeUndefined();
      for (const field of [
        "password",
        "verificationToken",
        "resetPasswordToken",
        "refreshSessionVersion",
        "subscription",
        "emailVerified",
        "averageRating",
        "ratingCount",
        "timezone",
      ]) {
        expect(body.business[field], field).toBeUndefined();
        expect(body.company[field], field).toBeUndefined();
      }

      const owner = await Owner.findOne({ userId });
      expect(owner).not.toBeNull();
      expect(owner?.country).toBe("USA");
      const company = await Company.findById(body.company._id);
      expect(company?.ownerId.toString()).toBe(owner?._id.toString());
      expect(company?.legalName).toBeUndefined();
      expect(company?.taxNumber).toBeUndefined();

      const business = await Business.findById(body.business._id);
      expect(business?.tradeName).toBe("Draft Venue");
      expect(business?.legalName).toBeUndefined();
      expect(business?.taxNumber).toBeUndefined();
      expect(business?.email).toBeUndefined();
      expect(business?.phoneNumber).toBeUndefined();
      expect(business?.address?.country).toBe("USA");
      expect(business?.address?.state).toBeUndefined();
    });

    it("creates a first venue with an explicit new-Company payload", async () => {
      const app = await getTestApp();
      const { auth } = await customerAuthToken();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { authorization: auth },
        payload: {
          ...draft,
          company: { legalName: "Taxpayer SL", taxNumber: "TAX-1" },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.company.legalName).toBe("Taxpayer SL");
      expect(body.company.taxNumber).toBe("TAX-1");
      expect(body.business.companyId).toBe(body.company._id);
      await expect(Owner.countDocuments()).resolves.toBe(1);
      await expect(Company.countDocuments()).resolves.toBe(1);
      await expect(Business.countDocuments()).resolves.toBe(1);
    });

    it("rejects a later venue with no Company choice and creates nothing", async () => {
      const app = await getTestApp();
      const { auth, userId } = await customerAuthToken();

      const first = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { authorization: auth },
        payload: draft,
      });
      expect(first.statusCode).toBe(201);
      const firstBody = JSON.parse(first.body);

      const second = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { authorization: auth },
        payload: { ...draft, tradeName: "Second Venue" },
      });

      expect(second.statusCode).toBe(400);
      expect(second.headers["content-type"]).toContain(
        "application/problem+json",
      );
      await expect(Owner.countDocuments({ userId })).resolves.toBe(1);
      await expect(Company.countDocuments()).resolves.toBe(1);
      await expect(Business.countDocuments()).resolves.toBe(1);
      expect(await Business.findById(firstBody.business._id)).not.toBeNull();
    });

    it("forms a new Company for a later venue with an empty Company payload", async () => {
      const app = await getTestApp();
      const { auth, userId } = await customerAuthToken();

      const first = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { authorization: auth },
        payload: draft,
      });
      const second = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { authorization: auth },
        payload: { ...draft, tradeName: "Second Venue", company: {} },
      });

      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(201);
      const firstBody = JSON.parse(first.body);
      const secondBody = JSON.parse(second.body);
      expect(secondBody.business._id).not.toBe(firstBody.business._id);
      expect(secondBody.company._id).not.toBe(firstBody.company._id);
      expect(secondBody.company.legalName).toBeUndefined();
      expect(secondBody.company.taxNumber).toBeUndefined();
      await expect(Owner.countDocuments({ userId })).resolves.toBe(1);
      await expect(Company.countDocuments()).resolves.toBe(2);
      await expect(Business.countDocuments()).resolves.toBe(2);
    });

    it("forms a new Company for a later venue with a legal name and tax number", async () => {
      const app = await getTestApp();
      const { auth } = await customerAuthToken();

      const first = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { authorization: auth },
        payload: draft,
      });
      const second = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { authorization: auth },
        payload: {
          ...draft,
          tradeName: "Second Venue",
          company: { legalName: "Other SL", taxNumber: "TAX-2" },
        },
      });

      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(201);
      const firstBody = JSON.parse(first.body);
      const secondBody = JSON.parse(second.body);
      expect(secondBody.company._id).not.toBe(firstBody.company._id);
      expect(secondBody.company.legalName).toBe("Other SL");
      expect(secondBody.company.taxNumber).toBe("TAX-2");
      await expect(Company.countDocuments()).resolves.toBe(2);
    });

    it("returns the same Owner, Company and Business for a retried idempotent request", async () => {
      const app = await getTestApp();
      const { auth, userId } = await customerAuthToken();
      const headers = {
        authorization: auth,
        "x-idempotency-key": "add-venue-once",
      };

      const first = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers,
        payload: draft,
      });
      const retry = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers,
        payload: draft,
      });

      expect(first.statusCode).toBe(201);
      expect(retry.statusCode).toBe(201);
      const firstBody = JSON.parse(first.body);
      const retryBody = JSON.parse(retry.body);
      expect(retryBody.business._id).toBe(firstBody.business._id);
      expect(retryBody.company._id).toBe(firstBody.company._id);
      await expect(Owner.countDocuments({ userId })).resolves.toBe(1);
      await expect(Company.countDocuments()).resolves.toBe(1);
      await expect(Business.countDocuments()).resolves.toBe(1);
    });

    it("joins an existing Company owned by the caller's Owner", async () => {
      const app = await getTestApp();
      const { auth, userId } = await customerAuthToken();

      const first = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { authorization: auth },
        payload: { ...draft, company: { legalName: "Taxpayer SL", taxNumber: "TAX-1" } },
      });
      const firstBody = JSON.parse(first.body);
      const second = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { authorization: auth },
        payload: {
          ...draft,
          tradeName: "Joined Venue",
          companyId: firstBody.company._id,
        },
      });

      expect(second.statusCode).toBe(201);
      const secondBody = JSON.parse(second.body);
      expect(secondBody.company._id).toBe(firstBody.company._id);
      expect(secondBody.company.legalName).toBe("Taxpayer SL");
      expect(secondBody.business.companyId).toBe(firstBody.company._id);
      await expect(Owner.countDocuments({ userId })).resolves.toBe(1);
      await expect(Company.countDocuments()).resolves.toBe(1);
    });

    it("rejects both Company choices in one request", async () => {
      const app = await getTestApp();
      const { auth } = await customerAuthToken();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { authorization: auth },
        payload: {
          ...draft,
          companyId: new Types.ObjectId().toString(),
          company: { legalName: "Taxpayer SL" },
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      await expect(Business.countDocuments()).resolves.toBe(0);
    });

    it("refuses a soft-deleted Company", async () => {
      const app = await getTestApp();
      const { auth, userId } = await customerAuthToken();
      const owner = await Owner.create({ userId, country: "USA" });
      const company = await Company.create({
        ownerId: owner._id,
        country: "USA",
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { authorization: auth },
        payload: { ...draft, companyId: company._id.toString() },
      });

      expect(response.statusCode).toBe(403);
      await expect(Business.countDocuments()).resolves.toBe(0);
    });

    it("rejects a Company that does not belong to the caller's Owner", async () => {
      const app = await getTestApp();
      const { auth } = await customerAuthToken();
      const other = await customerAuthToken();
      const otherOwner = await Owner.create({
        userId: other.userId,
        country: "USA",
      });
      const foreignCompany = await Company.create({
        ownerId: otherOwner._id,
        country: "USA",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { authorization: auth },
        payload: { ...draft, companyId: foreignCompany._id.toString() },
      });

      expect(response.statusCode).toBe(403);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      await expect(Business.countDocuments()).resolves.toBe(0);
    });

    it("rejects a Company in another country", async () => {
      const app = await getTestApp();
      const { auth, userId } = await customerAuthToken();
      const owner = await Owner.create({ userId, country: "USA" });
      const foreignCompany = await Company.create({
        ownerId: owner._id,
        country: "Canada",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { authorization: auth },
        payload: { ...draft, companyId: foreignCompany._id.toString() },
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      await expect(Business.countDocuments()).resolves.toBe(0);
    });

    it("rejects a later venue in a country other than the Owner's", async () => {
      const app = await getTestApp();
      const { auth } = await customerAuthToken();

      const first = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { authorization: auth },
        payload: draft,
      });
      expect(first.statusCode).toBe(201);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { authorization: auth },
        payload: { ...draft, country: "Canada" },
      });

      expect(response.statusCode).toBe(400);
      await expect(Business.countDocuments()).resolves.toBe(1);
    });

    it("validates the request body with problem details", async () => {
      const app = await getTestApp();
      const { auth } = await customerAuthToken();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { authorization: auth },
        payload: { tradeName: "No Currency", country: "USA" },
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = JSON.parse(response.body);
      expect(body.errors?.some((e: { path: string }) => e.path === "currencyTrade")).toBe(true);
    });
  });

  describe("GET /api/v1/business", () => {
    it("lists all businesses", async () => {
      const app = await getTestApp();

      await createTestBusiness({
        tradeName: "Test Restaurant",
        legalName: "Test Restaurant LLC",
        email: "test@restaurant.com",
        phoneNumber: "1234567890",
        taxNumber: "TAX-001",
        currencyTrade: "USD",
        address: validAddress,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/business",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].tradeName).toBe("Test Restaurant");
      expect(body[0].password).toBeUndefined();
    });

    it("never exposes legacy credential columns stored on an existing row", async () => {
      const app = await getTestApp();
      const { company } = await createTestOwnerCompany({ country: "USA" });

      await Business.collection.insertOne({
        tradeName: "Legacy Venue",
        legalName: "Legacy Venue LLC",
        email: "legacy@venue.com",
        password: "legacy-hash",
        verificationToken: "legacy-confirm",
        resetPasswordToken: "legacy-reset",
        resetPasswordExpires: new Date(),
        pendingEmail: "legacy-new@venue.com",
        pendingEmailToken: "legacy-pending",
        pendingEmailExpires: new Date(),
        refreshSessionVersion: 4,
        phoneNumber: "1234567890",
        taxNumber: "TAX-LEGACY-001",
        currencyTrade: "USD",
        address: validAddress,
        companyId: company._id,
        deleted: false,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/business",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body[0].tradeName).toBe("Legacy Venue");
      for (const field of [
        "password",
        "verificationToken",
        "resetPasswordToken",
        "resetPasswordExpires",
        "pendingEmail",
        "pendingEmailToken",
        "pendingEmailExpires",
        "refreshSessionVersion",
      ]) {
        expect(body[0][field], field).toBeUndefined();
      }
    });

    it("returns 400 when no businesses exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/business",
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = JSON.parse(response.body);
      expect(body.detail).toBe("No business found!");
    });

    it("filters by cuisineType", async () => {
      const app = await getTestApp();

      await createTestBusiness({
        tradeName: "Italian Place",
        legalName: "Italian Place LLC",
        email: "italian@test.com",
        phoneNumber: "1234567890",
        taxNumber: "TAX-IT-001",
        currencyTrade: "USD",
        address: validAddress,
        cuisineType: ["Italian"],
      });
      await createTestBusiness({
        tradeName: "Mexican Place",
        legalName: "Mexican Place LLC",
        email: "mexican@test.com",
        phoneNumber: "1234567891",
        taxNumber: "TAX-MX-001",
        currencyTrade: "USD",
        address: validAddress,
        cuisineType: ["Mexican"],
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/business?cuisineType=Italian",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.length).toBe(1);
      expect(body[0].cuisineType).toEqual(["Italian"]);
    });

    it("filters by name (tradeName)", async () => {
      const app = await getTestApp();

      await createTestBusiness({
        tradeName: "Pizza Paradise",
        legalName: "Pizza Paradise LLC",
        email: "pizza@test.com",
        phoneNumber: "1234567890",
        taxNumber: "TAX-PIZ-001",
        currencyTrade: "USD",
        address: validAddress,
      });
      await createTestBusiness({
        tradeName: "Burger Barn",
        legalName: "Burger Barn LLC",
        email: "burger@test.com",
        phoneNumber: "1234567891",
        taxNumber: "TAX-BUR-001",
        currencyTrade: "USD",
        address: validAddress,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/business?name=Pizza",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.length).toBe(1);
      expect(body[0].tradeName).toBe("Pizza Paradise");
    });

    it("returns 400 for an out-of-range rating", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/business?rating=6",
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = JSON.parse(response.body);
      expect(body.errors?.map((e: { path: string }) => e.path)).toContain(
        "rating",
      );
    });
  });

  describe("GET /api/v1/business/:businessId", () => {
    it("gets business by ID for an owning User", async () => {
      const app = await getTestApp();

      const { user: owner, company } = await createTestOwnerCompany({
        country: "USA",
      });
      const business = await createTestBusiness({
        tradeName: "Get Test Business",
        legalName: "Get Test Business LLC",
        email: "gettest@business.com",
        phoneNumber: "1234567890",
        taxNumber: "TAX-GET-001",
        currencyTrade: "USD",
        address: validAddress,
        companyId: company._id,
      });
      const auth = await businessOwnerToken(
        owner._id.toString(),
        owner.personalDetails.email,
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/business/${business._id}`,
        headers: { authorization: auth },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.tradeName).toBe("Get Test Business");
      // Legacy venue tax identity stays readable even though it is not editable here.
      expect(body.legalName).toBe("Get Test Business LLC");
      expect(body.taxNumber).toBe("TAX-GET-001");
      expect(body.password).toBeUndefined();
      expect(body.verificationToken).toBeUndefined();
      expect(body.resetPasswordToken).toBeUndefined();
      expect(body.resetPasswordExpires).toBeUndefined();
    });

    it("falls back to UTC and flags the default when no timezone is stored", async () => {
      const app = await getTestApp();

      const business = await createTestBusiness({
        tradeName: "No Zone Business",
        legalName: "No Zone Business LLC",
        email: "no-zone@business.com",
        phoneNumber: "1234567890",
        taxNumber: "TAX-NO-ZONE-001",
        currencyTrade: "USD",
        address: validAddress,
      });
      const auth = await businessAccessToken(app, business._id.toString());

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/business/${business._id}`,
        headers: { authorization: auth },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.timezone).toBe("UTC");
      expect(body.timezoneIsDefault).toBe(true);
    });

    it("returns 401 when GET business without auth", async () => {
      const app = await getTestApp();

      const business = await createTestBusiness({
        tradeName: "No Auth Get",
        legalName: "No Auth Get LLC",
        email: "noauthget@business.com",
        phoneNumber: "1234567890",
        taxNumber: "TAX-NOAUTHGET-001",
        currencyTrade: "USD",
        address: validAddress,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/business/${business._id}`,
      });

      expect(response.statusCode).toBe(401);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
    });

    it("returns 403 when GET business with a User without venue access", async () => {
      const app = await getTestApp();

      const business = await createTestBusiness({
        tradeName: "Employee Get",
        legalName: "Employee Get LLC",
        email: "employee-get@business.com",
        phoneNumber: "1234567890",
        taxNumber: "TAX-EMP-GET-001",
        currencyTrade: "USD",
        address: validAddress,
      });
      const auth = await generateTestToken({
        id: business._id.toString(),
        email: "employee-get@business.com",
        type: "user",
        role: "Manager",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/business/${business._id}`,
        headers: { authorization: auth },
      });

      expect(response.statusCode).toBe(403);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
    });

    it("returns 403 when the User has no access to the route business", async () => {
      const app = await getTestApp();

      const business = await createTestBusiness({
        tradeName: "Mismatch Get",
        legalName: "Mismatch Get LLC",
        email: "mismatch-get@business.com",
        phoneNumber: "1234567890",
        taxNumber: "TAX-MISMATCH-GET-001",
        currencyTrade: "USD",
        address: validAddress,
      });
      const auth = await generateTestToken({
        id: new Types.ObjectId().toString(),
        email: "no-access@test.com",
        type: "user",
        role: "Customer",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/business/${business._id}`,
        headers: { authorization: auth },
      });

      expect(response.statusCode).toBe(403);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
    });

    it("returns 400 for invalid ID format", async () => {
      const app = await getTestApp();
      const auth = await generateTestToken({
        id: new Types.ObjectId().toString(),
        email: "no-access@test.com",
        type: "user",
        role: "Customer",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/business/invalid-id",
        headers: { authorization: auth },
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = JSON.parse(response.body);
      expect(body.errors?.map((e: { path: string }) => e.path)).toContain(
        "businessId",
      );
    });

    it("returns 403 when the User has no access to a non-existent business", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();
      const auth = await generateTestToken({
        id: new Types.ObjectId().toString(),
        email: "no-access@test.com",
        type: "user",
        role: "Customer",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/business/${fakeId}`,
        headers: { authorization: auth },
      });

      expect(response.statusCode).toBe(403);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = JSON.parse(response.body);
      expect(body.detail).toBe("Forbidden");
    });
  });

  describe("PATCH /api/v1/business/:businessId", () => {
    it("returns a validation problem for an invalid businessId", async () => {
      const app = await getTestApp();
      const auth = await generateTestToken({
        id: new Types.ObjectId().toString(),
        email: "no-access@test.com",
        type: "user",
        role: "Customer",
      });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/business/invalid-id",
        headers: {
          "content-type": "multipart/form-data; boundary=----formdata",
          authorization: auth,
        },
        payload: "------formdata--\r\n",
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = JSON.parse(response.body);
      expect(body.errors?.map((e: { path: string }) => e.path)).toContain(
        "businessId",
      );
    });

    it("returns 403 for a non-existent business without venue access", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();
      const auth = await generateTestToken({
        id: new Types.ObjectId().toString(),
        email: "no-access@test.com",
        type: "user",
        role: "Customer",
      });

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nUpdated Business',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${fakeId}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it("returns 401 when PATCH business without auth", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness({
        tradeName: "No Auth Patch",
        legalName: "No Auth Patch LLC",
        email: "noauthpatch@business.com",
        phoneNumber: "1234567890",
        taxNumber: "TAX-NOAUTH-001",
        currencyTrade: "USD",
        address: validAddress,
      });

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nX',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload,
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 403 when PATCH business with a User without venue access", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness({
        tradeName: "Employee Patch",
        legalName: "Employee Patch LLC",
        email: "employee-patch@business.com",
        phoneNumber: "1234567890",
        taxNumber: "TAX-EMP-PATCH-001",
        currencyTrade: "USD",
        address: validAddress,
      });
      const auth = await generateTestToken({
        id: business._id.toString(),
        email: "employee-patch@business.com",
        type: "user",
        role: "Manager",
      });

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nX',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it("returns 403 when the User has no access to the route business", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness({
        tradeName: "Mismatch Patch",
        legalName: "Mismatch Patch LLC",
        email: "mismatch-patch@business.com",
        phoneNumber: "1234567890",
        taxNumber: "TAX-MISMATCH-001",
        currencyTrade: "USD",
        address: validAddress,
      });
      const auth = await generateTestToken({
        id: new Types.ObjectId().toString(),
        email: "no-access@test.com",
        type: "user",
        role: "Customer",
      });

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nX',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it("updates business successfully", async () => {
      const app = await getTestApp();

      const business = await createTestBusiness({
        tradeName: "Original Business",
        legalName: "Original Business LLC",
        email: "original@business.com",
        phoneNumber: "1234567890",
        taxNumber: "TAX-ORIG-001",
        currencyTrade: "USD",
        address: validAddress,
      });

      const auth = await businessAccessToken(app, business._id.toString());

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nUpdated Business',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Business updated successfully");
      expect(body.accessToken).toBeUndefined();
      expect(response.cookies.find((cookie) => cookie.name === "refresh_token")).toBeUndefined();

      const updated = await Business.findById(business._id);
      expect(updated?.tradeName).toBe("Updated Business");
    });

    it("saves the venue contact email and clears its verification", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness({
        tradeName: "Reject Email Co",
        legalName: "Reject Email Co LLC",
        email: "reject-email-patch@business.com",
        emailVerified: true,
        phoneNumber: "1234567890",
        taxNumber: "TAX-REJECT-EMAIL-001",
        currencyTrade: "USD",
        address: validAddress,
      });

      const auth = await businessAccessToken(app, business._id.toString());

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nReject Email Co',
        `--${boundary}`,
        'Content-Disposition: form-data; name="email"\r\n\r\nnew-reject-email@business.com',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const stored = await Business.findById(business._id).lean();
      expect(stored?.email).toBe("new-reject-email@business.com");
      expect(stored?.emailVerified).toBe(false);
    });

    it("dispatches BUSINESS_PROFILE_UPDATED to manager recipients after successful patch", async () => {
      const app = await getTestApp();
      const previousEmailToggle = process.env.COMMUNICATIONS_EMAIL_ENABLED;
      process.env.COMMUNICATIONS_EMAIL_ENABLED = "false";

      const business = await createTestBusiness({
        tradeName: "Notify Business",
        legalName: "Notify Business LLC",
        email: "notify@business.com",
        phoneNumber: "1234567890",
        taxNumber: "TAX-NOTIFY-001",
        currencyTrade: "USD",
        address: validAddress,
      });

      const managerUser = await User.create({
        personalDetails: {
          username: `notify-manager-${Date.now()}`,
          email: "notify-manager@test.com",
          password: "hashedpassword",
          firstName: "Notify",
          lastName: "Manager",
          phoneNumber: "9999999999",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          idType: "National ID",
          idNumber: `ID-NOTIFY-${Date.now()}`,
          address: validAddress,
        },
        allUserRoles: ["Employee"],
      });

      const managerEmployee = await Employee.create({
        businessId: business._id,
        userId: managerUser._id,
        taxNumber: `EMP-NOTIFY-${Date.now()}`,
        joinDate: new Date(),
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
        allEmployeeRoles: ["Manager"],
        currentShiftRole: "Manager",
        onDuty: false,
        active: true,
      });

      const auth = await businessAccessToken(app, business._id.toString());

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nNotify Business Updated',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
          "x-correlation-id": "corr-route-biz-patch-001",
          "x-idempotency-key": "op-route-biz-patch-001",
        },
        payload,
      });

      expect(response.statusCode).toBe(200);

      let notifications: Array<{ message: string }> = [];
      for (let attempt = 0; attempt < 5; attempt += 1) {
        notifications = (await Notification.find({
          businessId: business._id,
          employeesRecipientsIds: managerEmployee._id,
        }).lean()) as Array<{ message: string }>;
        if (
          notifications.some((n) =>
            n.message.includes("Business profile updated"),
          )
        ) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(
        notifications.some((n) => n.message.includes("Business profile updated")),
      ).toBe(true);

      if (previousEmailToggle === undefined) {
        delete process.env.COMMUNICATIONS_EMAIL_ENABLED;
      } else {
        process.env.COMMUNICATIONS_EMAIL_ENABLED = previousEmailToggle;
      }
    });

    it("profile PATCH triggers manager email send when email channel is enabled", async () => {
      const app = await getTestApp();
      const previousEmailToggle = process.env.COMMUNICATIONS_EMAIL_ENABLED;
      const previousInAppToggle = process.env.COMMUNICATIONS_INAPP_ENABLED;
      process.env.COMMUNICATIONS_EMAIL_ENABLED = "true";
      process.env.COMMUNICATIONS_INAPP_ENABLED = "true";

      const business = await createTestBusiness({
        tradeName: "Email Dispatch Business",
        legalName: "Email Dispatch LLC",
        email: "emaildispatch@business.com",
        phoneNumber: "1234567890",
        taxNumber: "TAX-EMAIL-001",
        currencyTrade: "USD",
        subscription: "Free",
        address: validAddress,
      });

      const managerUser = await User.create({
        personalDetails: {
          username: `email-mgr-${Date.now()}`,
          email: "email-mgr-profile@test.com",
          password: "hashedpassword",
          firstName: "Email",
          lastName: "Manager",
          phoneNumber: "9991112222",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          idType: "National ID",
          idNumber: `ID-EMAIL-${Date.now()}`,
          address: validAddress,
        },
        allUserRoles: ["Employee"],
      });

      await Employee.create({
        businessId: business._id,
        userId: managerUser._id,
        taxNumber: `EMP-EMAIL-${Date.now()}`,
        joinDate: new Date(),
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
        allEmployeeRoles: ["Manager"],
        currentShiftRole: "Manager",
        onDuty: false,
        active: true,
      });

      const auth = await businessAccessToken(app, business._id.toString());

      const emailSpy = vi.spyOn(emailChannel, "send").mockResolvedValue({
        channel: "email",
        success: true,
        sentCount: 1,
      });

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nEmail Dispatch Business Updated',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload,
      });

      expect(response.statusCode).toBe(200);

      for (let attempt = 0; attempt < 50 && emailSpy.mock.calls.length === 0; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      expect(emailSpy.mock.calls.length).toBeGreaterThanOrEqual(1);

      const firstEmailPayload = emailSpy.mock.calls[0][0];
      expect(firstEmailPayload.eventName).toBe("BUSINESS_PROFILE_UPDATED");
      expect(firstEmailPayload.subject).toBe("Business profile updated");
      expect(typeof firstEmailPayload.text).toBe("string");
      expect(firstEmailPayload.text).toContain("The business profile was updated.");
      expect(firstEmailPayload.text).toContain(business._id.toString());

      emailSpy.mockRestore();
      if (previousEmailToggle === undefined) {
        delete process.env.COMMUNICATIONS_EMAIL_ENABLED;
      } else {
        process.env.COMMUNICATIONS_EMAIL_ENABLED = previousEmailToggle;
      }
      if (previousInAppToggle === undefined) {
        delete process.env.COMMUNICATIONS_INAPP_ENABLED;
      } else {
        process.env.COMMUNICATIONS_INAPP_ENABLED = previousInAppToggle;
      }
    });

    it("skips BUSINESS_PROFILE_UPDATED dispatch when patch has no meaningful changes", async () => {
      const app = await getTestApp();
      const previousEmailToggle = process.env.COMMUNICATIONS_EMAIL_ENABLED;
      process.env.COMMUNICATIONS_EMAIL_ENABLED = "false";

      const business = await createTestBusiness({
        tradeName: "No Change Business",
        legalName: "No Change Business LLC",
        email: "nochange@business.com",
        phoneNumber: "1234567890",
        taxNumber: "TAX-NOCHANGE-001",
        currencyTrade: "USD",
        subscription: "Free",
        timezone: "America/Los_Angeles",
        address: validAddress,
      });

      const managerUser = await User.create({
        personalDetails: {
          username: `nochange-manager-${Date.now()}`,
          email: "nochange-manager@test.com",
          password: "hashedpassword",
          firstName: "No",
          lastName: "Change",
          phoneNumber: "8888888888",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          idType: "National ID",
          idNumber: `ID-NOCHANGE-${Date.now()}`,
          address: validAddress,
        },
        allUserRoles: ["Employee"],
      });

      const managerEmployee = await Employee.create({
        businessId: business._id,
        userId: managerUser._id,
        taxNumber: `EMP-NOCHANGE-${Date.now()}`,
        joinDate: new Date(),
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
        allEmployeeRoles: ["Manager"],
        currentShiftRole: "Manager",
        onDuty: true,
        active: true,
      });

      const auth = await businessAccessToken(app, business._id.toString());

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nNo Change Business',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
          "x-correlation-id": "corr-route-no-change-001",
          "x-idempotency-key": "op-route-no-change-001",
        },
        payload,
      });

      expect(response.statusCode).toBe(200);

      // Because route dispatch is intentionally fire-and-forget, poll briefly
      // for any unexpected profile-update notification that would indicate
      // skip logic failed on no-change payloads.
      let notifications: Array<{ message: string }> = [];
      for (let attempt = 0; attempt < 5; attempt += 1) {
        notifications = (await Notification.find({
          businessId: business._id,
          employeesRecipientsIds: managerEmployee._id,
        }).lean()) as Array<{ message: string }>;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      expect(
        notifications.some((n) => n.message.includes("Business profile updated")),
      ).toBe(false);

      if (previousEmailToggle === undefined) {
        delete process.env.COMMUNICATIONS_EMAIL_ENABLED;
      } else {
        process.env.COMMUNICATIONS_EMAIL_ENABLED = previousEmailToggle;
      }
    });

    it("rejects password and currentPassword as unknown keys", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness({
        tradeName: "Credential Reject Business",
        legalName: "Credential Reject Business LLC",
        email: "cred-reject@business.com",
        phoneNumber: "1234567890",
        taxNumber: `TAX-CRED-REJECT-${Date.now()}`,
        currencyTrade: "USD",
        subscription: "Free",
        address: validAddress,
      });

      const auth = await businessAccessToken(app, business._id.toString());

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nCredential Reject Business',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
        `--${boundary}`,
        'Content-Disposition: form-data; name="password"\r\n\r\nNewPass1!b',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currentPassword"\r\n\r\nOldPass1!a',
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload,
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const messages = (JSON.parse(response.body).errors ?? []).map(
        (e: { message: string }) => e.message,
      );
      expect(messages.some((m: string) => m.includes("password"))).toBe(true);
      expect(messages.some((m: string) => m.includes("currentPassword"))).toBe(
        true,
      );
    });
  });

  describe("PATCH venue profile fields", () => {
    const fullAddress = { ...validAddress, complement: "Suite 5" };
    const fullMetrics = {
      foodCostPercentage: 31,
      beverageCostPercentage: 17,
      laborCostPercentage: 29,
      fixedCostPercentage: 23,
      supplierGoodWastePercentage: {
        veryLowBudgetImpact: 8,
        lowBudgetImpact: 6,
        mediumBudgetImpact: 4,
        hightBudgetImpact: 2,
        veryHightBudgetImpact: 1,
      },
    };

    async function createVenue(
      app: Awaited<ReturnType<typeof getTestApp>>,
      overrides: Record<string, unknown> = {},
    ) {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const business = await createTestBusiness({
        tradeName: "Profile Fields Biz",
        legalName: "Profile Fields Biz LLC",
        email: `profile-fields-${suffix}@business.com`,
        phoneNumber: "1234567890",
        taxNumber: `TAX-PF-${suffix}`,
        currencyTrade: "USD",
        subscription: "Free",
        address: fullAddress,
        ...overrides,
      });
      const auth = await businessAccessToken(app, business._id.toString());
      return { business, auth };
    }

    function patchPayload(
      boundary: string,
      business: { tradeName: string; legalName: string; taxNumber: string },
      options: {
        address?: unknown;
        metrics?: unknown;
        reportingConfig?: unknown;
      } = {},
    ): string {
      const parts = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="tradeName"\r\n\r\n${business.tradeName}`,
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(options.address ?? fullAddress)}`,
      ];
      if (options.metrics !== undefined) {
        parts.push(
          `--${boundary}`,
          `Content-Disposition: form-data; name="metrics"\r\n\r\n${JSON.stringify(options.metrics)}`,
        );
      }
      if (options.reportingConfig !== undefined) {
        parts.push(
          `--${boundary}`,
          `Content-Disposition: form-data; name="reportingConfig"\r\n\r\n${JSON.stringify(options.reportingConfig)}`,
        );
      }
      parts.push(`--${boundary}--`);
      return parts.join("\r\n");
    }

    it("leaves omitted profile fields unchanged", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const { business, auth } = await createVenue(app, { metrics: fullMetrics });

      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nRenamed Venue',
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload,
      });

      expect(response.statusCode).toBe(200);
      const stored = await Business.findById(business._id).lean();
      expect(stored?.tradeName).toBe("Renamed Venue");
      expect(stored?.legalName).toBe("Profile Fields Biz LLC");
      expect(stored?.taxNumber).toBe(business.taxNumber);
      expect(stored?.phoneNumber).toBe("1234567890");
      expect(stored?.currencyTrade).toBe("USD");
      expect(stored?.address).toMatchObject(fullAddress);
      expect(stored?.metrics?.foodCostPercentage).toBe(31);
    });

    it("saves a draft profile without an address or phone", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const business = await createTestBusiness({
        tradeName: "Draft Profile Biz",
        currencyTrade: "USD",
        address: { country: "USA" },
      });
      const auth = await businessAccessToken(app, business._id.toString());

      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nDraft Profile Renamed',
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload,
      });

      expect(response.statusCode).toBe(200);
      const stored = await Business.findById(business._id).lean();
      expect(stored?.tradeName).toBe("Draft Profile Renamed");
      expect(stored?.phoneNumber).toBeUndefined();
      expect(stored?.address?.country).toBe("USA");
    });

    it("merges a partial address without changing the omitted fields", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const business = await createTestBusiness({
        tradeName: "Partial Address Biz",
        currencyTrade: "USD",
        address: { country: "USA" },
      });
      const auth = await businessAccessToken(app, business._id.toString());

      const payload = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify({ city: "Austin" })}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload,
      });

      expect(response.statusCode).toBe(200);
      const stored = await Business.findById(business._id).lean();
      expect(stored?.address).toMatchObject({ country: "USA", city: "Austin" });
    });

    it("rejects legal name and tax number as Company-only fields", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const { business, auth } = await createVenue(app);

      for (const field of ["legalName", "taxNumber"]) {
        const payload = [
          `--${boundary}`,
          `Content-Disposition: form-data; name="${field}"\r\n\r\nCompany Owned`,
          `--${boundary}--`,
        ].join("\r\n");

        const response = await app.inject({
          method: "PATCH",
          url: `/api/v1/business/${business._id}`,
          headers: {
            "content-type": `multipart/form-data; boundary=${boundary}`,
            authorization: auth,
          },
          payload,
        });

        expect(response.statusCode, field).toBe(400);
        const body = JSON.parse(response.body);
        expect(
          body.errors?.some((e: { message: string }) =>
            e.message.includes(field),
          ),
          field,
        ).toBe(true);
      }
    });

    it("recomputes the timezone when the address changes", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const { business, auth } = await createVenue(app, {
        timezone: "America/Bogota",
        address: { ...fullAddress, country: "Colombia", state: "Antioquia" },
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload: patchPayload(boundary, business, {
          address: { ...fullAddress, country: "USA", state: "New York" },
        }),
      });

      expect(response.statusCode).toBe(200);
      const stored = await Business.findById(business._id).lean();
      expect(stored?.timezone).toBe("America/New_York");
    });

    it("clears the timezone when the address becomes unmappable", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const { business, auth } = await createVenue(app, {
        timezone: "America/Bogota",
        address: { ...fullAddress, country: "Colombia", state: "Antioquia" },
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload: patchPayload(boundary, business, {
          address: { ...fullAddress, country: "Atlantis", state: "Nowhere" },
        }),
      });

      expect(response.statusCode).toBe(200);
      const stored = await Business.findById(business._id).lean();
      expect(stored?.timezone).toBeUndefined();
    });

    it("preserves unchanged address fields when part of the address changes", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const { business, auth } = await createVenue(app);
      const nextAddress = { ...fullAddress, country: "Canada", state: "Ontario" };

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload: patchPayload(boundary, business, { address: nextAddress }),
      });

      expect(response.statusCode).toBe(200);
      const stored = await Business.findById(business._id).lean();
      expect(stored?.address).toMatchObject(nextAddress);
      expect(stored?.address.complement).toBe("Suite 5");
    });

    it("preserves unchanged metrics when one metric changes", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const { business, auth } = await createVenue(app, { metrics: fullMetrics });
      const nextMetrics = { ...fullMetrics, foodCostPercentage: 42 };

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload: patchPayload(boundary, business, { metrics: nextMetrics }),
      });

      expect(response.statusCode).toBe(200);
      const stored = await Business.findById(business._id).lean();
      expect(stored?.metrics?.foodCostPercentage).toBe(42);
      expect(stored?.metrics?.beverageCostPercentage).toBe(17);
      expect(
        stored?.metrics?.supplierGoodWastePercentage?.lowBudgetImpact,
      ).toBe(6);
    });

    it("persists the weekly report start day", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const { business, auth } = await createVenue(app);

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload: patchPayload(boundary, business, {
          reportingConfig: { weeklyReportStartDay: 3 },
        }),
      });

      expect(response.statusCode).toBe(200);
      const stored = await Business.findById(business._id).lean();
      expect(stored?.reportingConfig?.weeklyReportStartDay).toBe(3);
    });
    it("rejects an out-of-range weekly report start day", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const { business, auth } = await createVenue(app);

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload: patchPayload(boundary, business, {
          reportingConfig: { weeklyReportStartDay: 9 },
        }),
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(
        body.errors?.some((e: { path: string }) =>
          e.path.startsWith("reportingConfig"),
        ),
      ).toBe(true);
    });

  });

  describe("DELETE /api/v1/business/:businessId", () => {
    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/business/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = JSON.parse(response.body);
      expect(body.errors?.map((e: { path: string }) => e.path)).toContain(
        "businessId",
      );
    });

    it("closes the business via soft delete and retains dependent records", async () => {
      const app = await getTestApp();
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const business = await createTestBusiness({
        tradeName: "Delete Test Business",
        legalName: "Delete Test Business LLC",
        email: `delete-business-${suffix}@business.com`,
        phoneNumber: "1234567890",
        taxNumber: `TAX-DELETE-${suffix}`,
        currencyTrade: "USD",
        address: validAddress,
      });

      const user = await User.create({
        personalDetails: {
          username: `delete-user-${suffix}`,
          email: `delete-user-${suffix}@test.com`,
          password: "hashedpassword",
          firstName: "Delete",
          lastName: "User",
          phoneNumber: "9999999999",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          idType: "National ID",
          idNumber: `ID-DELETE-${suffix}`,
          address: validAddress,
        },
        allUserRoles: ["Employee"],
      });

      const employee = await Employee.create({
        businessId: business._id,
        userId: user._id,
        taxNumber: `EMP-DELETE-${suffix}`,
        joinDate: new Date(),
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
        allEmployeeRoles: ["Manager"],
        currentShiftRole: "Manager",
        onDuty: false,
        active: true,
      });

      const notification = await Notification.create({
        notificationType: "Info",
        message: "Delete route retention test",
        businessId: business._id,
        employeesRecipientsIds: [employee._id],
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/business/${business._id}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        message: "Business deleted successfully",
      });

      const deletedBusiness = await Business.findById(business._id)
        .setOptions({ includeDeleted: true })
        .select("deleted deletedAt")
        .lean();
      expect(deletedBusiness?.deleted).toBe(true);
      expect(deletedBusiness?.deletedAt).toBeInstanceOf(Date);

      const retainedEmployee = await Employee.findById(employee._id)
        .select("deleted")
        .lean();
      expect(retainedEmployee?.deleted).toBe(false);

      const retainedNotification = await Notification.findById(notification._id)
        .select("deleted")
        .lean();
      expect(retainedNotification?.deleted).toBe(false);
    });

    it("excludes a closed business from active-default reads", async () => {
      const app = await getTestApp();
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const business = await createTestBusiness({
        tradeName: "Closed Discovery Business",
        legalName: "Closed Discovery Business LLC",
        email: `closed-discovery-${suffix}@business.com`,
        phoneNumber: "1234567890",
        taxNumber: `TAX-CLOSED-${suffix}`,
        currencyTrade: "USD",
        address: validAddress,
      });

      const closeResponse = await app.inject({
        method: "DELETE",
        url: `/api/v1/business/${business._id}`,
      });
      expect(closeResponse.statusCode).toBe(200);

      const defaultRead = await app.inject({
        method: "GET",
        url: "/api/v1/business",
      });
      expect(defaultRead.statusCode).toBe(400);
      expect(defaultRead.headers["content-type"]).toContain(
        "application/problem+json",
      );
      expect(JSON.parse(defaultRead.body).detail).toBe("No business found!");

      const includeDeletedRead = await app.inject({
        method: "GET",
        url: "/api/v1/business?includeDeleted=true",
      });
      expect(includeDeletedRead.statusCode).toBe(200);
      expect(
        JSON.parse(includeDeletedRead.body).some(
          (entry: { _id: string }) => entry._id === business._id.toString(),
        ),
      ).toBe(true);
    });
  });
});

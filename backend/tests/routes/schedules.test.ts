/**
 * Schedules Routes Tests — read routes.
 *
 * The unsafe legacy mutations are retired until their build-order row lands.
 * Every error response is an RFC 9457 `application/problem+json` document
 * produced by the global handler, so assertions are on the problem-details
 * shape rather than a bare `{ message }`.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { generateTestToken, getTestApp } from "../setup.ts";
import { injectWithRouteAuth } from "../helpers/auth.ts";
import Schedule from "../../src/models/schedule.ts";
import Employee from "../../src/models/employee.ts";
import { createTestBusiness } from "../helpers/fixtures.ts";
import User from "../../src/models/user.ts";

const expectProblem = (
  response: {
    statusCode: number;
    headers: Record<string, unknown>;
    json: () => any;
  },
  status: number,
  typeSlug: string,
) => {
  expect(response.statusCode).toBe(status);
  expect(response.headers["content-type"]).toContain("application/problem+json");
  const body = response.json();
  expect(body.type).toBe(`https://restaurant-pos.app/errors/${typeSlug}`);
  expect(body.status).toBe(status);
  return body;
};

const fieldPaths = (body: { errors?: Array<{ path: string }> }): string[] =>
  (body.errors ?? []).map((e) => e.path);

describe("Schedules Routes", () => {
  let businessId: Types.ObjectId;
  let userId: Types.ObjectId;

  const validAddress = {
    country: "USA",
    state: "CA",
    city: "Los Angeles",
    street: "Main St",
    buildingNumber: "123",
    postCode: "90001",
  };

  beforeEach(async () => {
    const business = await createTestBusiness({
      tradeName: "Test Restaurant",
      legalName: "Test Restaurant LLC",
      email: "test@restaurant.com",
      phoneNumber: "1234567890",
      taxNumber: "TAX-001",
      currencyTrade: "USD",
      address: validAddress,
    });
    businessId = business._id;

    const user = await User.create({
      username: "scheduleuser",
      email: "scheduleuser@test.com",
      password: "hashedpassword",
      allUserRoles: ["employee"],
      personalDetails: {
        username: "scheduleuser",
        email: "scheduleuser@test.com",
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
    userId = user._id;

    await Employee.create({
      businessId,
      userId,
      taxNumber: "EMP-TAX-001",
      joinDate: new Date(),
      vacationDaysPerYear: 20,
      vacationDaysLeft: 20,
      allEmployeeRoles: ["Waiter"],
    });

  });

  describe("GET /api/v1/schedules", () => {
    it("lists all schedules", async () => {
      const app = await getTestApp();

      await Schedule.create({
        businessId,
        date: new Date(),
        weekNumber: 1,
      });
      await Schedule.create({
        businessId,
        date: new Date(Date.now() + 86_400_000),
        weekNumber: 2,
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/schedules",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
    });

    it("includes soft-deleted schedules when includeDeleted=true", async () => {
      const app = await getTestApp();

      await Schedule.create({
        businessId,
        date: new Date(),
        weekNumber: 1,
      });
      await Schedule.create({
        businessId,
        date: new Date(Date.now() + 86_400_000),
        weekNumber: 2,
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/schedules?includeDeleted=true",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().length).toBe(2);
    });

    it("returns 404 when no schedules exist", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/schedules",
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("No schedules found!");
    });

    it("returns a validation problem for an invalid includeDeleted query value", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/schedules?includeDeleted=maybe",
      });

      const body = expectProblem(response, 400, "validation");
      expect(fieldPaths(body)).toContain("includeDeleted");
    });
  });


  describe("GET /api/v1/schedules/:scheduleId", () => {
    it("gets schedule by ID", async () => {
      const app = await getTestApp();

      const schedule = await Schedule.create({
        businessId,
        date: new Date(),
        weekNumber: 2,
      });

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/schedules/${schedule._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body._id).toBe(schedule._id.toString());
    });

    it("returns 400 for invalid ID format", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/schedules/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(fieldPaths(body)).toContain("scheduleId");
    });

    it("returns 404 for non-existent schedule", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/schedules/${fakeId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("No schedule found!");
    });

    it("returns 404 for soft-deleted schedule by default", async () => {
      const app = await getTestApp();
      const schedule = await Schedule.create({
        businessId,
        date: new Date(),
        weekNumber: 2,
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/schedules/${schedule._id}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("No schedule found!");
    });

    it("returns soft-deleted schedule when includeDeleted=true", async () => {
      const app = await getTestApp();
      const schedule = await Schedule.create({
        businessId,
        date: new Date(),
        weekNumber: 2,
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/schedules/${schedule._id}?includeDeleted=true`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().deleted).toBe(true);
    });
  });






  describe("GET /api/v1/schedules/business/:businessId/daily", () => {
    it("returns a validation problem for an invalid dayKey", async () => {
      const app = await getTestApp();
      const authorization = await generateTestToken({
        id: userId.toString(),
        email: "scheduleuser@test.com",
        type: "user",
        role: "Waiter",
      });

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/schedules/business/${businessId}/daily?dayKey=not-a-date`,
        headers: { authorization },
      });

      const body = expectProblem(response, 400, "validation");
      expect(fieldPaths(body)).toContain("dayKey");
    });
  });

  describe("GET /api/v1/schedules/business/:businessId", () => {
    it("lists schedules by business", async () => {
      const app = await getTestApp();

      await Schedule.create({
        businessId,
        date: new Date(),
        weekNumber: 5,
      });
      await Schedule.create({
        businessId,
        date: new Date(Date.now() + 86_400_000),
        weekNumber: 6,
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/schedules/business/${businessId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
    });

    it("lists deleted schedules by business when includeDeleted=true", async () => {
      const app = await getTestApp();

      await Schedule.create({
        businessId,
        date: new Date(),
        weekNumber: 5,
      });
      await Schedule.create({
        businessId,
        date: new Date(Date.now() + 86_400_000),
        weekNumber: 6,
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/schedules/business/${businessId}?includeDeleted=true`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().length).toBe(2);
    });

    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/schedules/business/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(fieldPaths(body)).toContain("businessId");
    });

    it("returns 404 when no schedules for business", async () => {
      const app = await getTestApp();
      const otherBusinessId = new Types.ObjectId();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/schedules/business/${otherBusinessId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("No schedules found!");
    });
  });

  describe("GET /api/v1/schedules/user/:userId", () => {
    it("returns 400 for invalid userId", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/schedules/user/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(fieldPaths(body)).toContain("userId");
    });

    it("returns 404 when user has no active employee membership", async () => {
      const app = await getTestApp();

      const newUser = await User.create({
        username: "noemployee",
        email: "noemployee@test.com",
        password: "hashedpassword",
        allUserRoles: ["employee"],
        personalDetails: {
          username: "noemployee",
          email: "noemployee@test.com",
          password: "hashedpassword",
          firstName: "No",
          lastName: "Employee",
          phoneNumber: "9876543210",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          idType: "National ID",
          idNumber: "987654321",
          address: validAddress,
        },
      });

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/schedules/user/${newUser._id}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe(
        "User not found or has no active employee membership!",
      );
    });

    it("returns 404 when no schedules for user", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/schedules/user/${userId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("No schedules found!");
    });
  });

});

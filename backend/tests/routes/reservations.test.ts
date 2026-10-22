/**
 * Reservations Routes Tests - Phase 1 Module 18 + Phase 4 Task 4.7
 * Tests for reservations CRUD endpoints with transaction verification
 *
 * Every error response is an RFC 9457 `application/problem+json` document
 * produced by the global handler, so assertions are on the problem-details
 * shape rather than a bare `{ message }`. Status-transition and role rules are
 * exercised with authenticated requests.
 */

import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { getTestApp, generateTestToken } from "../setup.ts";
import Reservation from "../../src/models/reservation.ts";
import Business from "../../src/models/business.ts";
import SalesPoint from "../../src/models/salesPoint.ts";
import User from "../../src/models/user.ts";
import Employee from "../../src/models/employee.ts";

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

describe("Reservations Routes", () => {
  const createTestBusiness = async () => {
    return await Business.create({
      tradeName: "Test Restaurant",
      legalName: "Test Restaurant LLC",
      email: `test${Date.now()}@restaurant.com`,
      password: "hashedpassword",
      phoneNumber: "1234567890",
      taxNumber: `TAX-${Date.now()}`,
      currencyTrade: "USD",
      subscription: "Free",
      address: {
        country: "USA",
        state: "CA",
        city: "Los Angeles",
        street: "Main St",
        buildingNumber: "123",
        postCode: "90001",
      },
    });
  };

  const createTestReservation = async (
    businessId: Types.ObjectId,
    opts?: { deleted?: boolean },
  ) => {
    return await Reservation.create({
      businessId,
      createdByUserId: new Types.ObjectId(),
      createdByRole: "customer",
      guestCount: 4,
      reservationStart: new Date("2024-06-15T19:00:00Z"),
      reservationEnd: new Date("2024-06-15T21:00:00Z"),
      status: "Pending",
      deleted: opts?.deleted,
      deletedAt: opts?.deleted ? new Date() : undefined,
    });
  };

  const userToken = () =>
    generateTestToken({
      id: new Types.ObjectId().toString(),
      email: "reservations@test.com",
      type: "user",
      role: "Customer",
    });

  describe("GET /api/v1/reservations", () => {
    it("lists all reservations", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestReservation(business._id as Types.ObjectId);
      await createTestReservation(business._id as Types.ObjectId, { deleted: true });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/reservations",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
    });

    it("includes deleted reservations when includeDeleted=true", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestReservation(business._id as Types.ObjectId);
      await createTestReservation(business._id as Types.ObjectId, { deleted: true });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/reservations?includeDeleted=true",
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().length).toBe(2);
    });

    it("returns a not-found problem when no reservations exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/reservations",
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("No reservations found!");
    });

    it("returns a validation problem for an invalid businessId filter", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/reservations?businessId=invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "businessId" }),
        ]),
      );
    });

    it("returns a validation problem for an invalid status filter", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/reservations?status=Bogus",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "status" })]),
      );
    });

    it("returns a bad-request problem for an invalid date range", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/reservations?startDate=2024-12-31&endDate=2024-01-01",
      });

      const body = expectProblem(response, 400, "bad-request");
      expect(body.detail).toBe(
        "Invalid date range, startDate must be before endDate!",
      );
    });

    it("rejects an unknown query key", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/reservations?limit=10",
      });

      expectProblem(response, 400, "validation");
    });
  });

  describe("POST /api/v1/reservations", () => {
    it("returns 401 without authentication", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/reservations",
        payload: {
          businessId: business._id,
          guestCount: 4,
          reservationStart: "2024-06-15T19:00:00Z",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns a validation problem for missing required fields", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/reservations",
        headers: { authorization: await userToken() },
        payload: { guestCount: 4 },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "businessId" }),
          expect.objectContaining({ path: "reservationStart" }),
        ]),
      );
    });

    it("returns a validation problem for an invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/reservations",
        headers: { authorization: await userToken() },
        payload: {
          businessId: "invalid-id",
          guestCount: 4,
          reservationStart: "2024-06-15T19:00:00Z",
        },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "businessId" }),
        ]),
      );
    });

    it("returns a validation problem for a non-positive guestCount", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/reservations",
        headers: { authorization: await userToken() },
        payload: {
          businessId: business._id.toString(),
          guestCount: 0,
          reservationStart: "2024-06-15T19:00:00Z",
        },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "guestCount" }),
        ]),
      );
    });

    it("returns a bad-request problem when reservationEnd is not after reservationStart", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/reservations",
        headers: { authorization: await userToken() },
        payload: {
          businessId: business._id.toString(),
          guestCount: 2,
          reservationStart: "2024-06-15T21:00:00Z",
          reservationEnd: "2024-06-15T19:00:00Z",
        },
      });

      const body = expectProblem(response, 400, "bad-request");
      expect(body.detail).toBe(
        "reservationEnd must be after reservationStart!",
      );
    });

    it("rejects an unknown key", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/reservations",
        headers: { authorization: await userToken() },
        payload: {
          businessId: business._id.toString(),
          guestCount: 2,
          reservationStart: "2024-06-15T19:00:00Z",
          status: "Confirmed",
        },
      });

      expectProblem(response, 400, "validation");
    });
  });

  describe("GET /api/v1/reservations/:reservationId", () => {
    it("returns a validation problem for an invalid ID", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/reservations/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "reservationId" }),
        ]),
      );
    });

    it("returns a not-found problem for a non-existent reservation", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reservations/${fakeId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("Reservation not found!");
    });

    it("gets reservation by ID", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const reservation = await createTestReservation(
        business._id as Types.ObjectId,
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reservations/${reservation._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body._id).toBe(reservation._id.toString());
    });

    it("returns not-found for soft-deleted reservation by default", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const reservation = await createTestReservation(
        business._id as Types.ObjectId,
        { deleted: true },
      );
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reservations/${reservation._id}`,
      });
      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("Reservation not found!");
    });

    it("returns soft-deleted reservation when includeDeleted=true", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const reservation = await createTestReservation(
        business._id as Types.ObjectId,
        { deleted: true },
      );
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reservations/${reservation._id}?includeDeleted=true`,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().deleted).toBe(true);
    });
  });

  describe("PATCH /api/v1/reservations/:reservationId", () => {
    it("returns 401 without authentication", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const reservation = await createTestReservation(
        business._id as Types.ObjectId,
      );

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/reservations/${reservation._id}`,
        payload: { guestCount: 6 },
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns a validation problem for an invalid reservationId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/reservations/invalid-id",
        headers: { authorization: await userToken() },
        payload: { guestCount: 6 },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "reservationId" }),
        ]),
      );
    });

    it("returns a validation problem for an invalid status value", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/reservations/${new Types.ObjectId()}`,
        headers: { authorization: await userToken() },
        payload: { status: "InvalidStatus" },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "status" })]),
      );
    });

    it("returns a not-found problem for a non-existent reservation", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/reservations/${new Types.ObjectId()}`,
        headers: { authorization: await userToken() },
        payload: { guestCount: 6 },
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("Reservation not found!");
    });

    it("rejects an unknown key", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/reservations/${new Types.ObjectId()}`,
        headers: { authorization: await userToken() },
        payload: { isAdmin: true },
      });

      expectProblem(response, 400, "validation");
    });

    it("rejects a client-supplied salesInstanceId (server-owned)", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/reservations/${new Types.ObjectId()}`,
        headers: { authorization: await userToken() },
        payload: { salesInstanceId: new Types.ObjectId().toString() },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining("salesInstanceId"),
          }),
        ]),
      );
    });
  });

  describe("DELETE /api/v1/reservations/:reservationId", () => {
    it("returns a validation problem for an invalid ID", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/reservations/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "reservationId" }),
        ]),
      );
    });

    it("returns a not-found problem for a non-existent reservation", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/reservations/${fakeId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("Reservation not found!");
    });

    it("soft-deletes reservation successfully", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const reservation = await createTestReservation(
        business._id as Types.ObjectId,
      );

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/reservations/${reservation._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Reservation deleted!");
      const persisted = await Reservation.findById(reservation._id)
        .setOptions({ includeDeleted: true })
        .lean();
      expect(persisted).not.toBeNull();
      expect(persisted?.deleted).toBe(true);
    });

    it("returns conflict when reservation already deleted", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const reservation = await createTestReservation(
        business._id as Types.ObjectId,
        { deleted: true },
      );
      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/reservations/${reservation._id}`,
      });
      const body = expectProblem(response, 409, "conflict");
      expect(body.detail).toBe("Reservation already deleted!");
    });
  });

  describe("GET /api/v1/reservations/business/:businessId", () => {
    it("returns a validation problem for an invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/reservations/business/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "businessId" }),
        ]),
      );
    });

    it("returns a not-found problem when no reservations for business", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reservations/business/${fakeId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("No reservations found!");
    });

    it("returns a bad-request problem for an invalid date range", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reservations/business/${business._id}?startDate=2024-12-31&endDate=2024-01-01`,
      });

      const body = expectProblem(response, 400, "bad-request");
      expect(body.detail).toBe(
        "Invalid date range, startDate must be before endDate!",
      );
    });

    it("returns a validation problem for an invalid status filter", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reservations/business/${business._id}?status=Bogus`,
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "status" })]),
      );
    });

    it("lists reservations by business", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestReservation(business._id as Types.ObjectId);
      await createTestReservation(business._id as Types.ObjectId, { deleted: true });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reservations/business/${business._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
    });

    it("lists deleted reservations by business when includeDeleted=true", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestReservation(business._id as Types.ObjectId);
      await createTestReservation(business._id as Types.ObjectId, { deleted: true });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reservations/business/${business._id}?includeDeleted=true`,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().length).toBe(2);
    });
  });

  // Phase 4 Task 4.7: Transaction Tests
  // POST and PATCH endpoints require JWT authentication (createAuthHook)
  // - POST/PATCH return 401 without authentication
  // - GET/DELETE endpoints work correctly
  // - SalesInstance creation on "Seated" status requires auth

  const validAddress = {
    country: "USA",
    state: "CA",
    city: "Los Angeles",
    street: "Main St",
    buildingNumber: "123",
    postCode: "90001",
  };

  describe("Transaction Tests - POST with Auth", () => {
    it("creates reservation with authenticated user", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const user = await User.create({
        personalDetails: {
          username: "rescustomer",
          email: "rescustomer@test.com",
          password: "hashedpassword123",
          firstName: "Test",
          lastName: "Customer",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          idType: "National ID",
          idNumber: "RES-CUST-001",
          address: validAddress,
        },
      });

      const token = await generateTestToken({
        id: user._id.toString(),
        email: "rescustomer@test.com",
        type: "user",
        role: "Customer",
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/reservations",
        headers: { authorization: token },
        payload: {
          businessId: business._id.toString(),
          guestCount: 4,
          reservationStart: futureDate.toISOString(),
          description: "Birthday dinner",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body._id).toBeDefined();
      expect(body.guestCount).toBe(4);

      const reservation = await Reservation.findOne({
        businessId: business._id,
      }).lean();
      expect(reservation).not.toBeNull();
      expect(reservation?.guestCount).toBe(4);
      expect(reservation?.createdByRole).toBe("customer");

      // Reservation pending flow is fire-and-forget; wait briefly for inbox update
      const timeoutMs = 1500;
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        const updatedUser = await User.findById(user._id).lean();
        const notificationsCount = updatedUser?.notifications?.length ?? 0;
        if (notificationsCount >= 1) {
          expect(notificationsCount).toBeGreaterThanOrEqual(1);
          return;
        }
        await new Promise((r) => setTimeout(r, 50));
      }

      const finalUser = await User.findById(user._id).lean();
      expect(finalUser?.notifications?.length ?? 0).toBeGreaterThanOrEqual(1);
    });

    it("creates reservation as employee when on duty", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const user = await User.create({
        personalDetails: {
          username: "resemployee",
          email: "resemployee@test.com",
          password: "hashedpassword123",
          firstName: "Test",
          lastName: "Employee",
          phoneNumber: "1234567891",
          birthDate: new Date("1992-01-01"),
          gender: "Woman",
          nationality: "USA",
          idType: "National ID",
          idNumber: "RES-EMP-001",
          address: validAddress,
        },
      });

      const employee = await Employee.create({
        businessId: business._id,
        userId: user._id,
        currentShiftRole: "Waiter",
        allEmployeeRoles: ["Admin"],
        onDuty: true,
        joinDate: new Date(),
        taxNumber: `RES-EMP-${Date.now()}`,
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
      });

      await User.updateOne(
        { _id: user._id },
        { $set: { employeeDetails: employee._id } },
      );

      const token = await generateTestToken({
        id: user._id.toString(),
        email: "resemployee@test.com",
        type: "user",
        businessId: business._id.toString(),
        canLogAsEmployee: true,
        role: "Admin",
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/reservations",
        headers: { authorization: token },
        payload: {
          businessId: business._id.toString(),
          guestCount: 2,
          reservationStart: futureDate.toISOString(),
        },
      });

      expect(response.statusCode).toBe(201);

      const reservation = await Reservation.findOne({
        businessId: business._id,
      }).lean();
      expect(reservation?.createdByRole).toBe("employee");

      // Employee creation doesn't trigger the customer pending flow
      await new Promise((r) => setTimeout(r, 100));
      const updatedUser = await User.findById(user._id).lean();
      expect(updatedUser?.notifications?.length ?? 0).toBe(0);
    });
  });

  describe("Transaction Tests - PATCH with Auth", () => {
    const createManagerContext = async () => {
      const business = await createTestBusiness();

      const user = await User.create({
        personalDetails: {
          username: `resmanager${Date.now()}`,
          email: `resmanager${Date.now()}@test.com`,
          password: "hashedpassword123",
          firstName: "Test",
          lastName: "Manager",
          phoneNumber: "1234567892",
          birthDate: new Date("1988-01-01"),
          gender: "Man",
          nationality: "USA",
          idType: "National ID",
          idNumber: `RES-MGR-${Date.now()}`,
          address: validAddress,
        },
      });

      const employee = await Employee.create({
        businessId: business._id,
        userId: user._id,
        currentShiftRole: "Host",
        allEmployeeRoles: ["Host", "Admin"],
        onDuty: true,
        joinDate: new Date(),
        taxNumber: `RES-MGR-${Date.now()}`,
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
      });

      await User.updateOne(
        { _id: user._id },
        { $set: { employeeDetails: employee._id } },
      );

      const token = await generateTestToken({
        id: user._id.toString(),
        email: "resmanager@test.com",
        type: "user",
        businessId: business._id.toString(),
        canLogAsEmployee: true,
        role: "Host",
      });

      return { business, user, token };
    };

    it("updates reservation status with authenticated employee", async () => {
      const app = await getTestApp();
      const { business, user, token } = await createManagerContext();

      const reservation = await Reservation.create({
        businessId: business._id,
        createdByUserId: user._id,
        createdByRole: "customer",
        guestCount: 4,
        reservationStart: new Date("2024-08-15T19:00:00Z"),
        reservationEnd: new Date("2024-08-15T21:00:00Z"),
        status: "Pending",
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/reservations/${reservation._id}`,
        headers: { authorization: token },
        payload: {
          status: "Confirmed",
        },
      });

      expect(response.statusCode).toBe(200);

      const updatedReservation = await Reservation.findById(
        reservation._id,
      ).lean();
      expect(updatedReservation?.status).toBe("Confirmed");

      // Decision flow is also fire-and-forget; wait briefly for inbox update
      const timeoutMs = 1500;
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        const updatedUser = await User.findById(user._id).lean();
        const notificationsCount = updatedUser?.notifications?.length ?? 0;
        if (notificationsCount >= 1) {
          expect(notificationsCount).toBeGreaterThanOrEqual(1);
          return;
        }
        await new Promise((r) => setTimeout(r, 50));
      }

      const finalUser = await User.findById(user._id).lean();
      expect(finalUser?.notifications?.length ?? 0).toBeGreaterThanOrEqual(1);
    });

    it("returns a bad-request problem for an invalid status transition", async () => {
      const app = await getTestApp();
      const { business, user, token } = await createManagerContext();

      const reservation = await Reservation.create({
        businessId: business._id,
        createdByUserId: user._id,
        createdByRole: "customer",
        guestCount: 4,
        reservationStart: new Date("2024-09-15T19:00:00Z"),
        reservationEnd: new Date("2024-09-15T21:00:00Z"),
        status: "Completed",
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/reservations/${reservation._id}`,
        headers: { authorization: token },
        payload: { status: "Confirmed" },
      });

      const body = expectProblem(response, 400, "bad-request");
      expect(body.detail).toBe(
        "Invalid status transition from Completed to Confirmed!",
      );
    });
  });
});

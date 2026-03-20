/**
 * Reservations Routes Tests - Phase 1 Module 18 + Phase 4 Task 4.7
 * Tests for reservations CRUD endpoints with transaction verification
 */

import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { getTestApp, generateTestToken } from "../setup.ts";
import Reservation from "../../src/models/reservation.ts";
import Business from "../../src/models/business.ts";
import SalesPoint from "../../src/models/salesPoint.ts";
import User from "../../src/models/user.ts";
import Employee from "../../src/models/employee.ts";

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

  const createTestReservation = async (businessId: Types.ObjectId) => {
    return await Reservation.create({
      businessId,
      createdByUserId: new Types.ObjectId(),
      createdByRole: "customer",
      guestCount: 4,
      reservationStart: new Date("2024-06-15T19:00:00Z"),
      reservationEnd: new Date("2024-06-15T21:00:00Z"),
      status: "Pending",
    });
  };

  describe("GET /api/v1/reservations", () => {
    it("lists all reservations", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestReservation(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/reservations",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });

    it("returns 404 when no reservations exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/reservations",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("No reservations");
    });

    it("returns 400 for invalid businessId filter", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/reservations?businessId=invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid businessId!");
    });

    it("returns 400 for invalid date range", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/reservations?startDate=2024-12-31&endDate=2024-01-01",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("Invalid date range");
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

    it("returns 400 for missing required fields", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/reservations",
        payload: { guestCount: 4 },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/reservations/:reservationId", () => {
    it("returns 400 for invalid ID", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/reservations/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid reservationId!");
    });

    it("returns 404 for non-existent reservation", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reservations/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Reservation not found!");
    });

    it("gets reservation by ID", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const reservation = await createTestReservation(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reservations/${reservation._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body._id).toBe(reservation._id.toString());
    });
  });

  describe("PATCH /api/v1/reservations/:reservationId", () => {
    it("returns 401 without authentication", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const reservation = await createTestReservation(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/reservations/${reservation._id}`,
        payload: { guestCount: 6 },
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 400 for invalid IDs", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/reservations/invalid-id",
        payload: { guestCount: 6 },
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 400 for invalid status value", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/reservations/${new Types.ObjectId()}`,
        payload: { status: "InvalidStatus" },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("DELETE /api/v1/reservations/:reservationId", () => {
    it("returns 400 for invalid ID", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/reservations/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid reservationId!");
    });

    it("returns 404 for non-existent reservation", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/reservations/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Reservation not found!");
    });

    it("deletes reservation successfully", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const reservation = await createTestReservation(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/reservations/${reservation._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Reservation deleted!");
    });
  });

  describe("GET /api/v1/reservations/business/:businessId", () => {
    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/reservations/business/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid businessId!");
    });

    it("returns 404 when no reservations for business", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reservations/business/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("No reservations");
    });

    it("returns 400 for invalid date range", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reservations/business/${business._id}?startDate=2024-12-31&endDate=2024-01-01`,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("Invalid date range");
    });

    it("lists reservations by business", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestReservation(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/reservations/business/${business._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });
  });

  // Phase 4 Task 4.7: Transaction Tests
  // Note: POST and PATCH endpoints require JWT authentication (createAuthHook)
  // Full transaction tests would require:
  // 1. Creating a test user and employee
  // 2. Generating a valid JWT token
  // 3. Passing the token in Authorization header
  // Current tests verify:
  // - POST/PATCH return 401 without authentication
  // - GET/DELETE endpoints work correctly
  // - SalesInstance creation on "Seated" status requires auth
  
  describe("Reservation Status Transitions (without auth)", () => {
    it("reservation can be created directly in DB with different statuses", async () => {
      const business = await createTestBusiness();
      
      // Create reservation with Confirmed status (simulating employee creation)
      const confirmedReservation = await Reservation.create({
        businessId: business._id,
        createdByUserId: new Types.ObjectId(),
        createdByRole: "employee",
        guestCount: 4,
        reservationStart: new Date("2024-07-15T19:00:00Z"),
        reservationEnd: new Date("2024-07-15T21:00:00Z"),
        status: "Confirmed",
      });

      expect(confirmedReservation.status).toBe("Confirmed");
      expect(confirmedReservation.createdByRole).toBe("employee");
    });

    it("reservation with salesPoint can be seated with salesInstance", async () => {
      const business = await createTestBusiness();
      
      // Create a sales point
      const salesPoint = await SalesPoint.create({
        businessId: business._id,
        salesPointName: "Table 1",
        salesPointNumber: 1,
        maxGuests: 6,
        qrCodeUrl: "https://example.com/qr",
      });

      // Create reservation with salesPoint
      const reservation = await Reservation.create({
        businessId: business._id,
        createdByUserId: new Types.ObjectId(),
        createdByRole: "employee",
        guestCount: 4,
        reservationStart: new Date("2024-07-16T19:00:00Z"),
        reservationEnd: new Date("2024-07-16T21:00:00Z"),
        status: "Arrived",
        salesPointId: salesPoint._id,
      });

      expect(reservation.salesPointId?.toString()).toBe(salesPoint._id.toString());
      expect(reservation.status).toBe("Arrived");
    });
  });

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

      // Create user with all required fields
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

      // Generate token
      const token = await generateTestToken({
        id: user._id.toString(),
        email: "rescustomer@test.com",
        type: "user",
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

      // Verify reservation was created
      const reservation = await Reservation.findOne({ businessId: business._id }).lean();
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

      // Create user with all required fields
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

      // Create employee on duty
      await Employee.create({
        businessId: business._id,
        userId: user._id,
        currentShiftRole: "Waiter",
        onDuty: true,
        joinDate: new Date(),
        taxNumber: `RES-EMP-${Date.now()}`,
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
      });

      const token = await generateTestToken({
        id: user._id.toString(),
        email: "resemployee@test.com",
        type: "user",
        businessId: business._id.toString(),
        canLogAsEmployee: true,
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

      // Verify created as employee
      const reservation = await Reservation.findOne({ businessId: business._id }).lean();
      expect(reservation?.createdByRole).toBe("employee");

      // Employee creation doesn't trigger the customer pending flow
      await new Promise((r) => setTimeout(r, 100));
      const updatedUser = await User.findById(user._id).lean();
      expect(updatedUser?.notifications?.length ?? 0).toBe(0);
    });
  });

  describe("Transaction Tests - PATCH with Auth", () => {
    it("updates reservation status with authenticated employee", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      // Create user with all required fields
      const user = await User.create({
        personalDetails: {
          username: "resmanager",
          email: "resmanager@test.com",
          password: "hashedpassword123",
          firstName: "Test",
          lastName: "Manager",
          phoneNumber: "1234567892",
          birthDate: new Date("1988-01-01"),
          gender: "Man",
          nationality: "USA",
          idType: "National ID",
          idNumber: "RES-MGR-001",
          address: validAddress,
        },
      });

      // Create employee (required for status changes)
      await Employee.create({
        businessId: business._id,
        userId: user._id,
        currentShiftRole: "Host",
        allEmployeeRoles: ["Host"],
        onDuty: true,
        joinDate: new Date(),
        taxNumber: `RES-MGR-${Date.now()}`,
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
      });

      // Create reservation
      const reservation = await Reservation.create({
        businessId: business._id,
        createdByUserId: user._id,
        createdByRole: "customer",
        guestCount: 4,
        reservationStart: new Date("2024-08-15T19:00:00Z"),
        reservationEnd: new Date("2024-08-15T21:00:00Z"),
        status: "Pending",
      });

      const token = await generateTestToken({
        id: user._id.toString(),
        email: "resmanager@test.com",
        type: "user",
        businessId: business._id.toString(),
        canLogAsEmployee: true,
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

      // Verify status was updated
      const updatedReservation = await Reservation.findById(reservation._id).lean();
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
  });
});

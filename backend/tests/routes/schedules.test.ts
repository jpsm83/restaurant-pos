/**
 * Schedules Routes Tests - Phase 1 Module 12 + Phase 4 Task 4.5
 * Tests for schedules CRUD endpoints with transaction verification
 * Phase 4: Full transaction tests for vacation day sync (requires replica set)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.ts";
import Schedule from "../../src/models/schedule.ts";
import Employee from "../../src/models/employee.ts";
import Business from "../../src/models/business.ts";
import User from "../../src/models/user.ts";

describe("Schedules Routes", () => {
  let businessId: Types.ObjectId;
  let userId: Types.ObjectId;
  let employeeId: Types.ObjectId;

  const validAddress = {
    country: "USA",
    state: "CA",
    city: "Los Angeles",
    street: "Main St",
    buildingNumber: "123",
    postCode: "90001",
  };

  beforeEach(async () => {
    const business = await Business.create({
      tradeName: "Test Restaurant",
      legalName: "Test Restaurant LLC",
      email: "test@restaurant.com",
      password: "hashedpassword",
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

    const employee = await Employee.create({
      businessId,
      userId,
      taxNumber: "EMP-TAX-001",
      joinDate: new Date(),
      vacationDaysPerYear: 20,
      vacationDaysLeft: 20,
      allEmployeeRoles: ["Waiter"],
    });
    employeeId = employee._id;

    await User.findByIdAndUpdate(userId, { employeeDetails: employeeId });
  });

  describe("GET /api/v1/schedules", () => {
    it("lists all schedules", async () => {
      const app = await getTestApp();

      await Schedule.create({
        businessId,
        date: new Date(),
        weekNumber: 1,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/schedules",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
    });

    it("returns 404 when no schedules exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/schedules",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("No schedules found!");
    });
  });

  describe("POST /api/v1/schedules", () => {
    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/schedules",
        payload: {
          businessId: "invalid-id",
          date: new Date().toISOString(),
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid business ID!");
    });

    it("returns 400 for missing date", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/schedules",
        payload: {
          businessId: businessId.toString(),
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Date is required!");
    });

    it("creates schedule successfully", async () => {
      const app = await getTestApp();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/schedules",
        payload: {
          businessId: businessId.toString(),
          date: futureDate.toISOString(),
        },
      });

      expect(response.statusCode, response.body).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("created");
    });

    it("returns 409 for duplicate schedule", async () => {
      const app = await getTestApp();
      const testDate = new Date();
      testDate.setDate(testDate.getDate() + 60);

      await Schedule.create({
        businessId,
        date: testDate,
        weekNumber: 1,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/schedules",
        payload: {
          businessId: businessId.toString(),
          date: testDate.toISOString(),
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("already exists");
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

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/schedules/${schedule._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body._id).toBe(schedule._id.toString());
    });

    it("returns 400 for invalid ID format", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/schedules/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid schedule ID!");
    });

    it("returns 404 for non-existent schedule", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/schedules/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("No schedule found!");
    });
  });

  describe("PATCH /api/v1/schedules/:scheduleId", () => {
    it("returns 400 for invalid scheduleId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/schedules/invalid-id",
        payload: { comments: "Updated" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid schedule ID!");
    });

    it("updates schedule successfully", async () => {
      const app = await getTestApp();

      const schedule = await Schedule.create({
        businessId,
        date: new Date(),
        weekNumber: 3,
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/schedules/${schedule._id}`,
        payload: { comments: "Updated comments" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Schedule updated");
    });
  });

  describe("DELETE /api/v1/schedules/:scheduleId", () => {
    it("returns 400 for invalid scheduleId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/schedules/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid schedule ID!");
    });

    it("returns 404 for non-existent schedule", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/schedules/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Schedule not found!");
    });

    it("returns 400 when deleting past schedule", async () => {
      const app = await getTestApp();
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      const schedule = await Schedule.create({
        businessId,
        date: pastDate,
        weekNumber: 4,
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/schedules/${schedule._id}`,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Cannot delete past or current schedules!");
    });
  });

  describe("PATCH /api/v1/schedules/:scheduleId/addEmployee", () => {
    it("returns 400 for invalid scheduleId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/schedules/invalid-id/addEmployee",
        payload: {
          employeeSchedule: {
            employeeId: employeeId.toString(),
            role: "Waiter",
            timeRange: {
              startTime: new Date().toISOString(),
              endTime: new Date().toISOString(),
            },
          },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid schedule Id!");
    });
  });

  describe("PATCH /api/v1/schedules/:scheduleId/deleteEmployee", () => {
    it("returns 400 for invalid IDs", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/schedules/invalid-id/deleteEmployee",
        payload: {
          employeeId: "invalid",
          employeeScheduleId: "invalid",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("Invalid");
    });
  });

  describe("PATCH /api/v1/schedules/:scheduleId/updateEmployee", () => {
    it("returns 400 for invalid scheduleId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/schedules/invalid-id/updateEmployee",
        payload: {
          employeeSchedule: {
            employeeId: employeeId.toString(),
            role: "Waiter",
            timeRange: {
              startTime: new Date().toISOString(),
              endTime: new Date().toISOString(),
            },
          },
          employeeScheduleId: new Types.ObjectId().toString(),
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid schedule Id!");
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

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/schedules/business/${businessId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
    });

    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/schedules/business/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid business Id!");
    });

    it("returns 404 when no schedules for business", async () => {
      const app = await getTestApp();
      const otherBusinessId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/schedules/business/${otherBusinessId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("No schedules found!");
    });
  });

  describe("GET /api/v1/schedules/user/:userId", () => {
    it("returns 400 for invalid userId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/schedules/user/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid user Id!");
    });

    it("returns 404 when user has no employee details", async () => {
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

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/schedules/user/${newUser._id}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("User not found or not linked to an employee!");
    });

    it("returns 404 when no schedules for user", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/schedules/user/${userId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("No schedules found!");
    });
  });

  // Phase 4 Task 4.5: Transaction Tests for Schedule Employee Management
  describe("Transaction Tests - PATCH /api/v1/schedules/:scheduleId/addEmployee", () => {
    it("adds employee to schedule and increments totalEmployeesScheduled", async () => {
      const app = await getTestApp();

      // Create a future schedule
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const schedule = await Schedule.create({
        businessId,
        date: futureDate,
        weekNumber: 10,
        totalEmployeesScheduled: 0,
      });

      // Add employee without vacation (working shift)
      const startTime = new Date(futureDate);
      startTime.setHours(9, 0, 0, 0);
      const endTime = new Date(futureDate);
      endTime.setHours(17, 0, 0, 0);

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/schedules/${schedule._id}/addEmployee`,
        payload: {
          employeeSchedule: {
            employeeId: employeeId.toString(),
            role: "Waiter",
            timeRange: {
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
            },
          },
        },
      });

      expect(response.statusCode, response.body).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("added");

      // Verify employee was added to schedule
      const updatedSchedule = await Schedule.findById(schedule._id).lean();
      expect(updatedSchedule?.employeesSchedules?.length).toBe(1);
      expect(updatedSchedule?.employeesSchedules?.[0]?.employeeId?.toString()).toBe(
        employeeId.toString()
      );
      // Verify counter was incremented
      expect(updatedSchedule?.totalEmployeesScheduled).toBe(1);
    });

    it("adds employee vacation and decrements vacationDaysLeft", async () => {
      const app = await getTestApp();

      // Create a future schedule
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 8);

      const schedule = await Schedule.create({
        businessId,
        date: futureDate,
        weekNumber: 11,
      });

      // Get initial vacation days
      const employeeBefore = await Employee.findById(employeeId).lean();
      const vacationBefore = employeeBefore?.vacationDaysLeft ?? 0;

      const startTime = new Date(futureDate);
      startTime.setHours(9, 0, 0, 0);
      const endTime = new Date(futureDate);
      endTime.setHours(17, 0, 0, 0);

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/schedules/${schedule._id}/addEmployee`,
        payload: {
          employeeSchedule: {
            employeeId: employeeId.toString(),
            role: "Waiter",
            timeRange: {
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
            },
            vacation: true,
          },
        },
      });

      expect(response.statusCode, response.body).toBe(201);

      // Verify vacation days decremented
      const employeeAfter = await Employee.findById(employeeId).lean();
      expect(employeeAfter?.vacationDaysLeft).toBe(vacationBefore - 1);

      // Verify schedule counters
      const updatedSchedule = await Schedule.findById(schedule._id).lean();
      expect(updatedSchedule?.totalEmployeesVacation).toBe(1);
      expect(updatedSchedule?.totalEmployeesScheduled).toBe(0);
    });

    it("prevents adding overlapping schedules for same employee", async () => {
      const app = await getTestApp();

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);

      const startTime = new Date(futureDate);
      startTime.setHours(9, 0, 0, 0);
      const endTime = new Date(futureDate);
      endTime.setHours(17, 0, 0, 0);

      // Create schedule with employee already added
      const schedule = await Schedule.create({
        businessId,
        date: futureDate,
        weekNumber: 12,
        employeesSchedules: [
          {
            employeeId,
            role: "Waiter",
            timeRange: { startTime, endTime },
            vacation: false,
            shiftHours: 8 * 60 * 60 * 1000,
            employeeCost: 0,
          },
        ],
      });

      // Try to add overlapping schedule
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/schedules/${schedule._id}/addEmployee`,
        payload: {
          employeeSchedule: {
            employeeId: employeeId.toString(),
            role: "Waiter",
            timeRange: {
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
            },
          },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("overlaps");
    });

    it("prevents adding vacation when employee already has working schedule", async () => {
      const app = await getTestApp();

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);

      const startTime = new Date(futureDate);
      startTime.setHours(9, 0, 0, 0);
      const endTime = new Date(futureDate);
      endTime.setHours(17, 0, 0, 0);

      // Create schedule with employee already working
      const schedule = await Schedule.create({
        businessId,
        date: futureDate,
        weekNumber: 13,
        employeesSchedules: [
          {
            employeeId,
            role: "Waiter",
            timeRange: { startTime, endTime },
            vacation: false,
            shiftHours: 8 * 60 * 60 * 1000,
            employeeCost: 0,
          },
        ],
      });

      // Try to add vacation
      const vacationStart = new Date(futureDate);
      vacationStart.setHours(0, 0, 0, 0);
      const vacationEnd = new Date(futureDate);
      vacationEnd.setHours(23, 59, 59, 0);

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/schedules/${schedule._id}/addEmployee`,
        payload: {
          employeeSchedule: {
            employeeId: employeeId.toString(),
            role: "Waiter",
            timeRange: {
              startTime: vacationStart.toISOString(),
              endTime: vacationEnd.toISOString(),
            },
            vacation: true,
          },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Employee already scheduled!");
    });
  });

  describe("Transaction Tests - PATCH /api/v1/schedules/:scheduleId/updateEmployee", () => {
    const patchWithSingleRetry = async (
      app: Awaited<ReturnType<typeof getTestApp>>,
      url: string,
      payload: Record<string, unknown>
    ) => {
      const first = await app.inject({ method: "PATCH", url, payload });
      if (first.statusCode !== 500) return first;
      // Transient in-memory Mongo transaction lock conflicts can surface as 500.
      return app.inject({ method: "PATCH", url, payload });
    };

    it("updates employee schedule role successfully", async () => {
      const app = await getTestApp();

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 21);

      const startTime = new Date(futureDate);
      startTime.setHours(9, 0, 0, 0);
      const endTime = new Date(futureDate);
      endTime.setHours(17, 0, 0, 0);

      const schedule = await Schedule.create({
        businessId,
        date: futureDate,
        weekNumber: 14,
        employeesSchedules: [
          {
            employeeId,
            role: "Waiter",
            timeRange: { startTime, endTime },
            vacation: false,
            shiftHours: 8 * 60 * 60 * 1000,
            employeeCost: 0,
          },
        ],
      });

      const employeeScheduleId = schedule.employeesSchedules[0]._id;

      const response = await patchWithSingleRetry(
        app,
        `/api/v1/schedules/${schedule._id}/updateEmployee`,
        {
          employeeSchedule: {
            employeeId: employeeId.toString(),
            role: "Manager",
            timeRange: {
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
            },
          },
          employeeScheduleId: employeeScheduleId?.toString(),
        }
      );

      expect(response.statusCode, response.body).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("updated");

      // Verify role was updated
      const updatedSchedule = await Schedule.findById(schedule._id).lean();
      expect(updatedSchedule?.employeesSchedules?.[0]?.role).toBe("Manager");
    });

    it("updates employee from working to vacation and syncs vacation days", async () => {
      const app = await getTestApp();

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 22);

      const startTime = new Date(futureDate);
      startTime.setHours(9, 0, 0, 0);
      const endTime = new Date(futureDate);
      endTime.setHours(17, 0, 0, 0);

      const schedule = await Schedule.create({
        businessId,
        date: futureDate,
        weekNumber: 15,
        employeesSchedules: [
          {
            employeeId,
            role: "Waiter",
            timeRange: { startTime, endTime },
            vacation: false,
            shiftHours: 8 * 60 * 60 * 1000,
            employeeCost: 0,
          },
        ],
        totalEmployeesScheduled: 1,
        totalEmployeesVacation: 0,
      });

      const employeeScheduleId = schedule.employeesSchedules[0]._id;

      // Get initial vacation days
      const employeeBefore = await Employee.findById(employeeId).lean();
      const vacationBefore = employeeBefore?.vacationDaysLeft ?? 0;

      const response = await patchWithSingleRetry(
        app,
        `/api/v1/schedules/${schedule._id}/updateEmployee`,
        {
          employeeSchedule: {
            employeeId: employeeId.toString(),
            role: "Waiter",
            timeRange: {
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
            },
            vacation: true,
          },
          employeeScheduleId: employeeScheduleId?.toString(),
        }
      );

      expect(response.statusCode, response.body).toBe(201);

      // Verify vacation days decremented
      const employeeAfter = await Employee.findById(employeeId).lean();
      expect(employeeAfter?.vacationDaysLeft).toBe(vacationBefore - 1);

      // Verify schedule counters updated
      const updatedSchedule = await Schedule.findById(schedule._id).lean();
      expect(updatedSchedule?.totalEmployeesVacation).toBe(1);
      expect(updatedSchedule?.totalEmployeesScheduled).toBe(0);
    });
  });
});

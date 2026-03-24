/**
 * Auth Helpers Tests - Task 0.1
 * Tests for canLogAsEmployee and middleware functions
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "./app.ts";
import canLogAsEmployee from "../../src/auth/canLogAsEmployee.ts";
import {
  createAuthHook,
  hasBusinessAccess,
} from "../../src/auth/middleware.ts";
import type { AuthSession, AuthUser, AuthBusiness } from "../../src/auth/types.ts";
import Employee from "../../src/models/employee.ts";
import Schedule from "../../src/models/schedule.ts";

describe("Auth Helpers", () => {
  const businessId = new Types.ObjectId();
  const userId = new Types.ObjectId();

  describe("canLogAsEmployee", () => {
    it("returns true for managers (management role bypass)", async () => {
      const employee = await Employee.create({
        businessId,
        userId,
        allEmployeeRoles: ["Manager"],
        taxNumber: "TAX-MGR-001",
        joinDate: new Date(),
        active: true,
        vacationDaysPerYear: 20,
      });

      const result = await canLogAsEmployee(employee._id);
      expect(result.canLogAsEmployee).toBe(true);
    });

    it("returns true during shift hours (within schedule)", async () => {
      const employee = await Employee.create({
        businessId,
        userId,
        allEmployeeRoles: ["Waiter"],
        taxNumber: "TAX-SHIFT-001",
        joinDate: new Date(),
        active: true,
        vacationDaysPerYear: 20,
      });

      const now = new Date();
      const shiftStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      const shiftEnd = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

      await Schedule.create({
        businessId,
        date: now,
        weekNumber: 1,
        employeesSchedules: [
          {
            employeeId: employee._id,
            role: "Waiter",
            timeRange: { startTime: shiftStart, endTime: shiftEnd },
            vacation: false,
            shiftHours: 2,
            employeeCost: 20,
          },
        ],
      });

      const result = await canLogAsEmployee(employee._id);
      expect(result.canLogAsEmployee).toBe(true);
    });

    it("returns false outside shift hours", async () => {
      const employee = await Employee.create({
        businessId,
        userId,
        allEmployeeRoles: ["Waiter"],
        taxNumber: "TAX-OUTSIDE-001",
        joinDate: new Date(),
        active: true,
        vacationDaysPerYear: 20,
      });

      const now = new Date();
      const shiftStart = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
      const shiftEnd = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours from now

      await Schedule.create({
        businessId,
        date: now,
        weekNumber: 1,
        employeesSchedules: [
          {
            employeeId: employee._id,
            role: "Waiter",
            timeRange: { startTime: shiftStart, endTime: shiftEnd },
            vacation: false,
            shiftHours: 2,
            employeeCost: 20,
          },
        ],
      });

      const result = await canLogAsEmployee(employee._id);
      expect(result.canLogAsEmployee).toBe(false);
    });

    it("returns false for inactive employee", async () => {
      const employee = await Employee.create({
        businessId,
        userId,
        allEmployeeRoles: ["Manager"],
        taxNumber: "TAX-INACTIVE-001",
        joinDate: new Date(),
        active: false,
        vacationDaysPerYear: 20,
      });

      const result = await canLogAsEmployee(employee._id);
      expect(result.canLogAsEmployee).toBe(false);
    });

    it("returns false for terminated employee", async () => {
      const joinDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const employee = await Employee.create({
        businessId,
        userId,
        allEmployeeRoles: ["Manager"],
        taxNumber: "TAX-TERMED-001",
        joinDate,
        active: true,
        terminatedDate: new Date(),
        vacationDaysPerYear: 20,
      });

      const result = await canLogAsEmployee(employee._id);
      expect(result.canLogAsEmployee).toBe(false);
    });

    it("returns false for non-existent employee", async () => {
      const fakeId = new Types.ObjectId();
      const result = await canLogAsEmployee(fakeId);
      expect(result.canLogAsEmployee).toBe(false);
    });
  });

  describe("createAuthHook", () => {
    it("rejects missing token", async () => {
      const app = await getTestApp();
      const authHook = createAuthHook(app);

      const mockReq = {
        headers: {},
      } as any;

      let sentResponse: any = null;
      const mockReply = {
        code: (statusCode: number) => ({
          send: (body: any) => {
            sentResponse = { statusCode, body };
            return mockReply;
          },
        }),
      } as any;

      await authHook.call(app as any, mockReq, mockReply, () => {});

      expect(sentResponse).not.toBeNull();
      expect(sentResponse.statusCode).toBe(401);
      expect(sentResponse.body.message).toBe("Authentication required");
    });

    it("rejects invalid token", async () => {
      const app = await getTestApp();
      const authHook = createAuthHook(app);

      const mockReq = {
        headers: {
          authorization: "Bearer invalid-token-here",
        },
      } as any;

      let sentResponse: any = null;
      const mockReply = {
        code: (statusCode: number) => ({
          send: (body: any) => {
            sentResponse = { statusCode, body };
            return mockReply;
          },
        }),
      } as any;

      await authHook.call(app as any, mockReq, mockReply, () => {});

      expect(sentResponse).not.toBeNull();
      expect(sentResponse.statusCode).toBe(401);
      expect(sentResponse.body.message).toBe("Invalid or expired access token");
    });

    it("accepts valid token and sets authSession", async () => {
      const app = await getTestApp();
      const authHook = createAuthHook(app);

      const payload: AuthBusiness = {
        id: businessId.toString(),
        email: "test@example.com",
        type: "business",
      };
      const token = app.jwt.sign(payload);

      const mockReq = {
        headers: {
          authorization: `Bearer ${token}`,
        },
        authSession: undefined as AuthSession | undefined,
      } as any;

      const mockReply = {
        code: () => ({ send: () => mockReply }),
      } as any;

      await authHook.call(app as any, mockReq, mockReply, () => {});

      expect(mockReq.authSession).toBeDefined();
      expect(mockReq.authSession.type).toBe("business");
      expect(mockReq.authSession.id).toBe(businessId.toString());
    });
  });

  describe("hasBusinessAccess", () => {
    const testBusinessId = new Types.ObjectId().toString();

    it("returns true for business account with matching ID", () => {
      const session: AuthBusiness = {
        id: testBusinessId,
        email: "business@example.com",
        type: "business",
      };

      expect(hasBusinessAccess(session, testBusinessId)).toBe(true);
    });

    it("returns false for business account with different ID", () => {
      const session: AuthBusiness = {
        id: new Types.ObjectId().toString(),
        email: "business@example.com",
        type: "business",
      };

      expect(hasBusinessAccess(session, testBusinessId)).toBe(false);
    });

    it("returns true for employee with matching businessId and canLogAsEmployee", () => {
      const session: AuthUser = {
        id: userId.toString(),
        email: "employee@example.com",
        type: "user",
        employeeId: new Types.ObjectId().toString(),
        businessId: testBusinessId,
        canLogAsEmployee: true,
      };

      expect(hasBusinessAccess(session, testBusinessId)).toBe(true);
    });

    it("returns false for employee without canLogAsEmployee", () => {
      const session: AuthUser = {
        id: userId.toString(),
        email: "employee@example.com",
        type: "user",
        employeeId: new Types.ObjectId().toString(),
        businessId: testBusinessId,
        canLogAsEmployee: false,
      };

      expect(hasBusinessAccess(session, testBusinessId)).toBe(false);
    });

    it("returns false for undefined session", () => {
      expect(hasBusinessAccess(undefined, testBusinessId)).toBe(false);
    });
  });
});

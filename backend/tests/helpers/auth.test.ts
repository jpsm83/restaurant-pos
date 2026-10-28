/**
 * Auth Helpers Tests - Task 0.1
 * Tests for canLogAsEmployee and middleware functions
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { getTestApp, signAccessTokenForLiveSession } from "../setup.ts";
import canLogAsEmployee from "../../src/auth/canLogAsEmployee.ts";
import getEffectiveUserRoleAtTime from "../../src/auth/getEffectiveUserRoleAtTime.ts";
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
    it("rejects missing token with a 401 AppError", async () => {
      const app = await getTestApp();
      const authHook = createAuthHook(app);

      const mockReq = {
        headers: {},
      } as any;

      await expect(
        authHook.call(app as any, mockReq, {} as any, () => {}),
      ).rejects.toMatchObject({
        name: "AppError",
        statusCode: 401,
        message: "Authentication required",
      });
    });

    it("rejects invalid token with a 401 AppError", async () => {
      const app = await getTestApp();
      const authHook = createAuthHook(app);

      const mockReq = {
        headers: {
          authorization: "Bearer invalid-token-here",
        },
      } as any;

      await expect(
        authHook.call(app as any, mockReq, {} as any, () => {}),
      ).rejects.toMatchObject({
        name: "AppError",
        statusCode: 401,
        message: "Invalid or expired access token",
      });
    });

    it("accepts valid token and sets authSession", async () => {
      const app = await getTestApp();
      const authHook = createAuthHook(app);

      const payload: AuthBusiness = {
        id: businessId.toString(),
        email: "test@example.com",
        type: "business",
        role: "Tenant",
      };
      const token = await signAccessTokenForLiveSession(app, payload);

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
      expect(mockReq.authSession.sessionId).toBeUndefined();
    });

    it("refuses a token with no session id", async () => {
      const app = await getTestApp();
      const authHook = createAuthHook(app);

      const payload: AuthBusiness = {
        id: businessId.toString(),
        email: "test@example.com",
        type: "business",
        role: "Tenant",
      };
      const token = app.jwt.sign(payload);

      const mockReq = {
        headers: {
          authorization: `Bearer ${token}`,
        },
      } as any;

      await expect(
        authHook.call(app as any, mockReq, {} as any, () => {}),
      ).rejects.toMatchObject({
        name: "AppError",
        statusCode: 401,
        message: "Invalid or expired access token",
      });
    });
  });

  describe("getEffectiveUserRoleAtTime", () => {
    const membership = async (overrides: {
      businessId?: Types.ObjectId;
      userId?: Types.ObjectId;
      role?: string;
      onDuty?: boolean;
      active?: boolean;
      terminatedDate?: Date;
      deleted?: boolean;
    } = {}) =>
      Employee.create({
        businessId: overrides.businessId ?? businessId,
        userId: overrides.userId ?? userId,
        allEmployeeRoles: [overrides.role ?? "Manager"],
        taxNumber: `ROLE-${new Types.ObjectId()}`,
        joinDate: new Date("2024-01-01"),
        vacationDaysPerYear: 20,
        onDuty: overrides.onDuty ?? true,
        active: overrides.active ?? true,
        terminatedDate: overrides.terminatedDate,
        deleted: overrides.deleted ?? false,
      });

    it("returns employee for an active on-duty member of that business", async () => {
      await membership();

      await expect(
        getEffectiveUserRoleAtTime({ userId, businessId }),
      ).resolves.toBe("employee");
    });

    it("returns customer when the membership belongs to another business", async () => {
      await membership();

      await expect(
        getEffectiveUserRoleAtTime({
          userId,
          businessId: new Types.ObjectId(),
        }),
      ).resolves.toBe("customer");
    });

    it("returns customer when the member is off duty", async () => {
      await membership({ onDuty: false });

      await expect(
        getEffectiveUserRoleAtTime({ userId, businessId }),
      ).resolves.toBe("customer");
    });

    it("returns customer for an inactive membership", async () => {
      await membership({ active: false });

      await expect(
        getEffectiveUserRoleAtTime({ userId, businessId }),
      ).resolves.toBe("customer");
    });

    it("returns customer for a terminated membership", async () => {
      await membership({ terminatedDate: new Date() });

      await expect(
        getEffectiveUserRoleAtTime({ userId, businessId }),
      ).resolves.toBe("customer");
    });

    it("returns customer for a soft-deleted membership", async () => {
      await membership({ deleted: true });

      await expect(
        getEffectiveUserRoleAtTime({ userId, businessId }),
      ).resolves.toBe("customer");
    });

    it("uses the schedule gate for non-management roles", async () => {
      const employee = await membership({ role: "Waiter" });
      const now = new Date();

      await Schedule.create({
        businessId,
        date: now,
        weekNumber: 1,
        employeesSchedules: [
          {
            employeeId: employee._id,
            role: "Waiter",
            timeRange: {
              startTime: new Date(now.getTime() - 60 * 60 * 1000),
              endTime: new Date(now.getTime() + 60 * 60 * 1000),
            },
            vacation: false,
            shiftHours: 2,
            employeeCost: 20,
          },
        ],
      });

      await expect(
        getEffectiveUserRoleAtTime({ userId, businessId, now }),
      ).resolves.toBe("employee");
      await expect(
        getEffectiveUserRoleAtTime({
          userId,
          businessId,
          now: new Date(now.getTime() + 4 * 60 * 60 * 1000),
        }),
      ).resolves.toBe("customer");
    });

    it("resolves each business independently for a multi-venue member", async () => {
      const secondBusinessId = new Types.ObjectId();
      await membership();
      await membership({ businessId: secondBusinessId });

      await expect(
        getEffectiveUserRoleAtTime({ userId, businessId }),
      ).resolves.toBe("employee");
      await expect(
        getEffectiveUserRoleAtTime({
          userId,
          businessId: secondBusinessId,
        }),
      ).resolves.toBe("employee");
    });
  });

  describe("hasBusinessAccess", () => {
    const testBusinessId = new Types.ObjectId().toString();

    it("returns true for business account with matching ID", () => {
      const session: AuthBusiness = {
        id: testBusinessId,
        email: "business@example.com",
        type: "business",
        role: "Tenant",
      };

      expect(hasBusinessAccess(session, testBusinessId)).toBe(true);
    });

    it("returns false for business account with different ID", () => {
      const session: AuthBusiness = {
        id: new Types.ObjectId().toString(),
        email: "business@example.com",
        type: "business",
        role: "Tenant",
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
        role: "Waiter",
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
        role: "Waiter",
      };

      expect(hasBusinessAccess(session, testBusinessId)).toBe(false);
    });

    it("returns false for undefined session", () => {
      expect(hasBusinessAccess(undefined, testBusinessId)).toBe(false);
    });
  });
});

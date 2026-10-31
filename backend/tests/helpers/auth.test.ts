/**
 * Auth Helpers Tests - Task 0.1
 * Tests for canLogAsEmployee and middleware functions
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { getTestApp, signAccessTokenForLiveSession } from "../setup.ts";
import canLogAsEmployee, {
  canUseBusinessMode,
} from "../../src/auth/canLogAsEmployee.ts";
import getEffectiveUserRoleAtTime from "../../src/auth/getEffectiveUserRoleAtTime.ts";
import { createAuthHook } from "../../src/auth/middleware.ts";
import type { AuthSession, AuthUser } from "../../src/auth/types.ts";
import Employee from "../../src/models/employee.ts";
import Schedule from "../../src/models/schedule.ts";
import { createTestBusiness, createTestOwnerCompany } from "../helpers/fixtures.ts";

describe("Auth Helpers", () => {
  let businessId: Types.ObjectId;
  const userId = new Types.ObjectId();

  beforeEach(async () => {
    const business = await createTestBusiness({
      tradeName: `Auth Helpers ${new Types.ObjectId()}`,
      currencyTrade: "EUR",
    });
    businessId = business._id;
  });

  describe("canLogAsEmployee", () => {
    const createEmployee = (roles: string[]) =>
      Employee.create({
        businessId,
        userId,
        allEmployeeRoles: roles,
        taxNumber: `TAX-${new Types.ObjectId()}`,
        joinDate: new Date(),
        active: true,
        vacationDaysPerYear: 20,
      });

    const addShift = async (params: {
      employeeId: Types.ObjectId;
      start: Date;
      end?: Date;
      vacation?: boolean;
    }) => {
      await Schedule.create({
        businessId,
        date: new Date(),
        weekNumber: 1,
        employeesSchedules: [
          {
            employeeId: params.employeeId,
            role: "Waiter",
            timeRange: {
              startTime: params.start,
              endTime:
                params.end ?? new Date(params.start.getTime() + 8 * 60 * 60 * 1000),
            },
            vacation: params.vacation ?? false,
            shiftHours: 8,
            employeeCost: 80,
          },
        ],
      });
    };

    it("returns true for manager and admin layers without a schedule", async () => {
      const manager = await createEmployee(["Manager"]);
      const admin = await createEmployee(["Admin"]);

      await expect(canLogAsEmployee(manager._id)).resolves.toEqual({
        canLogAsEmployee: true,
      });
      await expect(canLogAsEmployee(admin._id)).resolves.toEqual({
        canLogAsEmployee: true,
      });
    });

    it("returns true during shift hours (within schedule)", async () => {
      const employee = await createEmployee(["Waiter"]);
      const now = new Date();
      await addShift({
        employeeId: employee._id,
        start: new Date(now.getTime() - 60 * 60 * 1000),
        end: new Date(now.getTime() + 60 * 60 * 1000),
      });

      const result = await canLogAsEmployee(employee._id, now);
      expect(result.canLogAsEmployee).toBe(true);
    });

    it("returns false outside shift hours", async () => {
      const employee = await createEmployee(["Waiter"]);
      const now = new Date();
      await addShift({
        employeeId: employee._id,
        start: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        end: new Date(now.getTime() + 4 * 60 * 60 * 1000),
      });

      const result = await canLogAsEmployee(employee._id, now);
      expect(result.canLogAsEmployee).toBe(false);
    });

    it("refuses a supervisor outside the entry window", async () => {
      const employee = await createEmployee(["Supervisor"]);
      const now = new Date();
      await addShift({
        employeeId: employee._id,
        start: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      });

      const result = await canLogAsEmployee(employee._id, now);
      expect(result.canLogAsEmployee).toBe(false);
    });

    it("lets a supervisor enter inside the entry window", async () => {
      const employee = await createEmployee(["Supervisor"]);
      const now = new Date();
      await addShift({
        employeeId: employee._id,
        start: new Date(now.getTime() - 5 * 60 * 1000),
      });

      const result = await canLogAsEmployee(employee._id, now);
      expect(result.canLogAsEmployee).toBe(true);
    });

    it("lets an employee enter at the ten-minutes-before boundary", async () => {
      const employee = await createEmployee(["Waiter"]);
      const now = new Date();
      await addShift({
        employeeId: employee._id,
        start: new Date(now.getTime() + 10 * 60 * 1000),
      });

      const result = await canLogAsEmployee(employee._id, now);
      expect(result.canLogAsEmployee).toBe(true);
    });

    it("refuses an employee one millisecond before the entry window", async () => {
      const employee = await createEmployee(["Waiter"]);
      const now = new Date();
      await addShift({
        employeeId: employee._id,
        start: new Date(now.getTime() + 10 * 60 * 1000 + 1),
      });

      const result = await canLogAsEmployee(employee._id, now);
      expect(result.canLogAsEmployee).toBe(false);
    });

    it("lets an employee enter at the two-hours-after-start boundary", async () => {
      const employee = await createEmployee(["Waiter"]);
      const now = new Date();
      await addShift({
        employeeId: employee._id,
        start: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      });

      const result = await canLogAsEmployee(employee._id, now);
      expect(result.canLogAsEmployee).toBe(true);
    });

    it("refuses an employee one millisecond after the entry window", async () => {
      const employee = await createEmployee(["Waiter"]);
      const now = new Date();
      await addShift({
        employeeId: employee._id,
        start: new Date(now.getTime() - 2 * 60 * 60 * 1000 - 1),
      });

      const result = await canLogAsEmployee(employee._id, now);
      expect(result.canLogAsEmployee).toBe(false);
    });

    it("ignores vacation rows when opening the entry window", async () => {
      const employee = await createEmployee(["Waiter"]);
      const now = new Date();
      await addShift({
        employeeId: employee._id,
        start: new Date(now.getTime() - 5 * 60 * 1000),
        vacation: true,
      });

      const result = await canLogAsEmployee(employee._id, now);
      expect(result.canLogAsEmployee).toBe(false);
    });

    it("keeps the entry window open after the shift end", async () => {
      const employee = await createEmployee(["Waiter"]);
      const now = new Date();
      await addShift({
        employeeId: employee._id,
        start: new Date(now.getTime() - 60 * 60 * 1000),
        end: new Date(now.getTime() - 30 * 60 * 1000),
      });

      const result = await canLogAsEmployee(employee._id, now);
      expect(result.canLogAsEmployee).toBe(true);
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

  describe("canUseBusinessMode", () => {
    it("allows an owner without a membership", async () => {
      const { user, company } = await createTestOwnerCompany();
      await createTestBusiness({
        companyId: company._id,
        tradeName: "Owner Mode Venue",
        currencyTrade: "EUR",
      });

      await expect(canUseBusinessMode(user._id)).resolves.toBe(true);
    });

    it("allows a manager member with no schedule", async () => {
      const employee = await Employee.create({
        businessId,
        userId,
        allEmployeeRoles: ["Manager"],
        taxNumber: `TAX-${new Types.ObjectId()}`,
        joinDate: new Date(),
        active: true,
        vacationDaysPerYear: 20,
      });
      expect(employee.active).toBe(true);

      await expect(canUseBusinessMode(userId)).resolves.toBe(true);
    });

    it("refuses a User with no ownership and no active membership", async () => {
      await expect(canUseBusinessMode(new Types.ObjectId())).resolves.toBe(
        false,
      );
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

      const payload: AuthUser = {
        id: userId.toString(),
        email: "test@example.com",
        type: "user",
        role: "Customer",
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
      expect(mockReq.authSession.type).toBe("user");
      expect(mockReq.authSession.id).toBe(userId.toString());
      expect(mockReq.authSession.sessionId).toBeUndefined();
    });

    it("refuses a token with no session id", async () => {
      const app = await getTestApp();
      const authHook = createAuthHook(app);

      const payload: AuthUser = {
        id: userId.toString(),
        email: "test@example.com",
        type: "user",
        role: "Customer",
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
      const secondBusiness = await createTestBusiness({
        tradeName: `Auth Helpers Second ${new Types.ObjectId()}`,
        currencyTrade: "EUR",
      });
      const secondBusinessId = secondBusiness._id;
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

});

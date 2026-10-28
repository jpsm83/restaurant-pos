/**
 * Auth Routes Tests - Phase 1 Module 1
 * Tests for authentication endpoints
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import bcrypt from "bcrypt";
import { getTestApp } from "../setup.ts";
import User from "../../src/models/user.ts";
import Business from "../../src/models/business.ts";
import Employee from "../../src/models/employee.ts";
import RefreshSession from "../../src/models/refreshSession.ts";

function accessTokenLifetimeSeconds(token: string): number {
  const payload = accessTokenClaims(token);
  return payload.exp - payload.iat;
}

function accessTokenSessionId(token: string): string | undefined {
  return accessTokenClaims(token).sessionId;
}

function accessTokenClaims(token: string): {
  iat: number;
  exp: number;
  sessionId?: string;
} {
  return JSON.parse(
    Buffer.from(token.split(".")[1], "base64url").toString(),
  ) as { iat: number; exp: number; sessionId?: string };
}

describe("Auth Routes", () => {
  const testPassword = "TestPassword123!";
  let hashedPassword: string;

  beforeEach(async () => {
    hashedPassword = await bcrypt.hash(testPassword, 10);
  });

  describe("POST /api/v1/auth/login", () => {
    it("logs in business with valid credentials", async () => {
      const app = await getTestApp();

      await Business.create({
        tradeName: "Test Business",
        legalName: "Test Business Legal",
        email: "business@test.com",
        password: hashedPassword,
        taxNumber: "TAX-BUS-001",
        phoneNumber: "1234567890",
        currencyTrade: "USD",
        address: {
          country: "USA",
          state: "CA",
          city: "LA",
          street: "Main St",
          buildingNumber: "123",
          postCode: "90001",
        },
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "business@test.com", password: testPassword },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.accessToken).toBeDefined();
      expect(body.user.type).toBe("business");
    });

    it("logs in user with valid credentials", async () => {
      const app = await getTestApp();

      await User.create({
        personalDetails: {
          email: "user@test.com",
          password: hashedPassword,
          firstName: "Test",
          lastName: "User",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          address: {
            country: "USA",
            state: "CA",
            city: "LA",
            street: "Main St",
            buildingNumber: "123",
            postCode: "90001",
          },
          idNumber: "ID123456",
          idType: "Passport",
          username: "testuser",
        },
        allUserRoles: ["Customer"],
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "user@test.com", password: testPassword },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.accessToken).toBeDefined();
      expect(body.user.type).toBe("user");
    });

    it("returns 401 for invalid credentials", async () => {
      const app = await getTestApp();

      await User.create({
        personalDetails: {
          email: "user2@test.com",
          password: hashedPassword,
          firstName: "Test",
          lastName: "User",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          address: {
            country: "USA",
            state: "CA",
            city: "LA",
            street: "Main St",
            buildingNumber: "123",
            postCode: "90001",
          },
          idNumber: "ID123457",
          idType: "Passport",
          username: "testuser2",
        },
        allUserRoles: ["Customer"],
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "user2@test.com", password: "wrongpassword" },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.type).toBe("https://restaurant-pos.app/errors/unauthorized");
      expect(body.detail).toBe("Invalid credentials");
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
    });

    it("returns 400 for missing email/password", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = response.json();
      expect(body.type).toBe("https://restaurant-pos.app/errors/validation");
      expect(body.detail).toBe("Request body is invalid");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "email" }),
          expect.objectContaining({ path: "password" }),
        ]),
      );
    });

    it("returns 401 for non-existent user", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "nonexistent@test.com", password: testPassword },
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 401 when credentials belong to a soft-deleted user", async () => {
      const app = await getTestApp();

      await User.create({
        deleted: true,
        deletedAt: new Date(),
        personalDetails: {
          email: "deleted-user@test.com",
          password: hashedPassword,
          firstName: "Deleted",
          lastName: "User",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          address: {
            country: "USA",
            state: "CA",
            city: "LA",
            street: "Main St",
            buildingNumber: "123",
            postCode: "90001",
          },
          idNumber: "ID-DELETED",
          idType: "Passport",
          username: "deleteduser",
        },
        allUserRoles: ["Customer"],
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "deleted-user@test.com", password: testPassword },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().detail).toBe("Invalid credentials");
    });

    it("returns 401 when credentials belong to a closed business", async () => {
      const app = await getTestApp();

      await Business.create({
        tradeName: "Closed Cafe",
        legalName: "Closed Cafe Legal",
        email: "closed-biz@test.com",
        password: hashedPassword,
        taxNumber: "TAX-CLOSED-LOGIN",
        phoneNumber: "1234567890",
        currencyTrade: "USD",
        deleted: true,
        deletedAt: new Date(),
        address: {
          country: "USA",
          state: "CA",
          city: "LA",
          street: "Main St",
          buildingNumber: "123",
          postCode: "90001",
        },
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "closed-biz@test.com", password: testPassword },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().detail).toBe("Invalid credentials");
    });

    it("does not grant staff sign-in for a soft-deleted employee membership", async () => {
      const app = await getTestApp();
      const user = await User.create({
        personalDetails: {
          email: "staff-removed@test.com",
          password: hashedPassword,
          firstName: "Staff",
          lastName: "Removed",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          address: {
            country: "USA",
            state: "CA",
            city: "LA",
            street: "Main St",
            buildingNumber: "123",
            postCode: "90001",
          },
          idNumber: "ID-STAFF-REMOVED",
          idType: "Passport",
          username: "staffremoved",
        },
      });
      const business = await Business.create({
        tradeName: "Staff Venue",
        legalName: "Staff Venue Legal",
        email: "staff-venue@test.com",
        password: hashedPassword,
        taxNumber: "TAX-STAFF-VENUE",
        phoneNumber: "1234567890",
        currencyTrade: "USD",
        address: {
          country: "USA",
          state: "CA",
          city: "LA",
          street: "Main St",
          buildingNumber: "123",
          postCode: "90001",
        },
      });
      const employee = await Employee.create({
        businessId: business._id,
        userId: user._id,
        taxNumber: "EMP-STAFF-REMOVED",
        joinDate: new Date(),
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
        allEmployeeRoles: ["Manager"],
        currentShiftRole: "Manager",
        onDuty: false,
        active: true,
      });
      const before = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "staff-removed@test.com", password: testPassword },
      });
      expect(before.statusCode).toBe(200);
      expect(before.json().user.canLogAsEmployee).toBe(true);

      await Employee.updateOne(
        { _id: employee._id },
        { $set: { deleted: true, deletedAt: new Date() } },
      );

      const after = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "staff-removed@test.com", password: testPassword },
      });
      expect(after.statusCode).toBe(200);
      expect(after.json().user.canLogAsEmployee).toBeUndefined();
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("clears session and returns success", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/json");
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Logged out successfully");
      expect(
        response.cookies.find((cookie) => cookie.name === "refresh_token")
          ?.value,
      ).toBe("");
      expect(
        response.cookies.find((cookie) => cookie.name === "auth_mode")?.value,
      ).toBe("");
    });

    it("ignores a body and stays without a request DTO", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
        payload: { paymentId: "pay-1" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().message).toBe("Logged out successfully");
    });

    it("revokes the presented refresh session, clears both cookies, and returns the success message", async () => {
      const app = await getTestApp();
      const email = "logout-one-session@test.com";
      await User.create({
        personalDetails: {
          email,
          password: hashedPassword,
          firstName: "Logout",
          lastName: "One",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          address: {
            country: "USA",
            state: "CA",
            city: "LA",
            street: "Main St",
            buildingNumber: "123",
            postCode: "90001",
          },
          idNumber: "ID-LOGOUT-ONE",
          idType: "Passport",
          username: "logoutone",
        },
      });

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password: testPassword },
      });
      expect(loginRes.statusCode).toBe(200);
      const refreshCookie = loginRes.cookies.find(
        (cookie) => cookie.name === "refresh_token",
      );
      expect(refreshCookie?.value).toBeTruthy();

      const logoutRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
        headers: { cookie: `refresh_token=${refreshCookie!.value}` },
      });

      expect(logoutRes.statusCode).toBe(200);
      expect(logoutRes.headers["content-type"]).toContain("application/json");
      expect(logoutRes.json()).toEqual({ message: "Logged out successfully" });
      expect(
        logoutRes.cookies.find((cookie) => cookie.name === "refresh_token")
          ?.value,
      ).toBe("");
      expect(
        logoutRes.cookies.find((cookie) => cookie.name === "auth_mode")?.value,
      ).toBe("");

      const refreshRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: { cookie: `refresh_token=${refreshCookie!.value}` },
      });

      expect(refreshRes.statusCode).toBe(401);
      expect(refreshRes.headers["content-type"]).toContain(
        "application/problem+json",
      );
      expect(refreshRes.json().detail).toBe("Invalid or expired refresh token");
      expect(refreshRes.json().accessToken).toBeUndefined();
      expect(
        refreshRes.cookies.find((cookie) => cookie.name === "refresh_token")
          ?.value,
      ).toBe("");
    });

    it("leaves the account generation unchanged", async () => {
      const app = await getTestApp();
      const email = "logout-generation@test.com";
      const user = await User.create({
        personalDetails: {
          email,
          password: hashedPassword,
          firstName: "Logout",
          lastName: "Generation",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          address: {
            country: "USA",
            state: "CA",
            city: "LA",
            street: "Main St",
            buildingNumber: "123",
            postCode: "90001",
          },
          idNumber: "ID-LOGOUT-GEN",
          idType: "Passport",
          username: "logoutgen",
        },
      });

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password: testPassword },
      });
      const refreshCookie = loginRes.cookies.find(
        (cookie) => cookie.name === "refresh_token",
      );
      expect(refreshCookie?.value).toBeTruthy();

      const logoutRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
        headers: { cookie: `refresh_token=${refreshCookie!.value}` },
      });
      expect(logoutRes.statusCode).toBe(200);

      const stored = await User.findById(user._id).select("refreshSessionVersion");
      expect(stored?.refreshSessionVersion ?? 0).toBe(0);
    });

    it("leaves the other user session able to refresh and call current-user", async () => {
      const app = await getTestApp();
      const email = "logout-peer-user@test.com";
      const user = await User.create({
        personalDetails: {
          email,
          password: hashedPassword,
          firstName: "Logout",
          lastName: "Peer",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          address: {
            country: "USA",
            state: "CA",
            city: "LA",
            street: "Main St",
            buildingNumber: "123",
            postCode: "90001",
          },
          idNumber: "ID-LOGOUT-PEER",
          idType: "Passport",
          username: "logoutpeer",
        },
      });

      const first = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password: testPassword },
      });
      const second = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password: testPassword },
      });
      const firstCookie = first.cookies.find(
        (cookie) => cookie.name === "refresh_token",
      );
      const secondCookie = second.cookies.find(
        (cookie) => cookie.name === "refresh_token",
      );
      expect(firstCookie?.value).toBeTruthy();
      expect(secondCookie?.value).toBeTruthy();
      expect(secondCookie!.value).not.toBe(firstCookie!.value);

      for (const cookie of [firstCookie!, secondCookie!]) {
        const beforeLogout = await app.inject({
          method: "POST",
          url: "/api/v1/auth/refresh",
          headers: { cookie: `refresh_token=${cookie.value}` },
        });
        expect(beforeLogout.statusCode).toBe(200);
        expect(beforeLogout.headers["content-type"]).toContain("application/json");
        expect(typeof beforeLogout.json().accessToken).toBe("string");
      }

      const logoutRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
        headers: { cookie: `refresh_token=${firstCookie!.value}` },
      });
      expect(logoutRes.statusCode).toBe(200);
      expect(logoutRes.headers["content-type"]).toContain("application/json");
      expect(logoutRes.json()).toEqual({ message: "Logged out successfully" });

      const signedOut = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: { cookie: `refresh_token=${firstCookie!.value}` },
      });
      expect(signedOut.statusCode).toBe(401);
      expect(signedOut.json().accessToken).toBeUndefined();

      const stillIn = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: { cookie: `refresh_token=${secondCookie!.value}` },
      });
      expect(stillIn.statusCode).toBe(200);
      expect(stillIn.headers["content-type"]).toContain("application/json");
      const stillInBody = stillIn.json();
      expect(typeof stillInBody.accessToken).toBe("string");
      expect(stillInBody.user.id).toBe(String(user._id));
      expect(stillInBody.user.sessionId).toBeUndefined();

      const currentUser = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${stillInBody.accessToken}` },
      });
      expect(currentUser.statusCode).toBe(200);
      expect(currentUser.headers["content-type"]).toContain("application/json");
      expect(currentUser.json().user.id).toBe(String(user._id));
      expect(currentUser.json().user.sessionId).toBeUndefined();

      const stored = await User.findById(user._id).select("refreshSessionVersion");
      expect(stored?.refreshSessionVersion ?? 0).toBe(0);
    });

    it("refuses the signed-out session's access token and still accepts the peer session", async () => {
      const app = await getTestApp();
      const email = "logout-access-peer@test.com";
      await User.create({
        personalDetails: {
          email,
          password: hashedPassword,
          firstName: "Logout",
          lastName: "Access",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          address: {
            country: "USA",
            state: "CA",
            city: "LA",
            street: "Main St",
            buildingNumber: "123",
            postCode: "90001",
          },
          idNumber: "ID-LOGOUT-ACCESS",
          idType: "Passport",
          username: "logoutaccess",
        },
      });

      const first = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password: testPassword },
      });
      const second = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password: testPassword },
      });
      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(200);
      const firstToken = first.json().accessToken as string;
      const secondToken = second.json().accessToken as string;
      const firstCookie = first.cookies.find(
        (cookie) => cookie.name === "refresh_token",
      );
      expect(firstCookie?.value).toBeTruthy();

      const logoutRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
        headers: { cookie: `refresh_token=${firstCookie!.value}` },
      });
      expect(logoutRes.statusCode).toBe(200);

      const signedOut = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${firstToken}` },
      });
      expect(signedOut.statusCode).toBe(401);
      expect(signedOut.headers["content-type"]).toContain(
        "application/problem+json",
      );
      expect(signedOut.json().detail).toBe("Invalid or expired access token");

      const stillIn = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${secondToken}` },
      });
      expect(stillIn.statusCode).toBe(200);
      expect(stillIn.headers["content-type"]).toContain("application/json");
      expect(stillIn.json().user.sessionId).toBeUndefined();
    });

    it("refuses a revoked access token on a protected route, resend-confirmation, and set-mode", async () => {
      const app = await getTestApp();
      const email = "logout-access-routes@test.com";
      await User.create({
        personalDetails: {
          email,
          password: hashedPassword,
          emailVerified: true,
          firstName: "Logout",
          lastName: "Routes",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          address: {
            country: "USA",
            state: "CA",
            city: "LA",
            street: "Main St",
            buildingNumber: "123",
            postCode: "90001",
          },
          idNumber: "ID-LOGOUT-ROUTES",
          idType: "Passport",
          username: "logoutroutes",
        },
      });

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password: testPassword },
      });
      expect(loginRes.statusCode).toBe(200);
      const accessToken = loginRes.json().accessToken as string;
      const refreshCookie = loginRes.cookies.find(
        (cookie) => cookie.name === "refresh_token",
      );
      expect(refreshCookie?.value).toBeTruthy();

      const before = await app.inject({
        method: "POST",
        url: "/api/v1/auth/set-mode",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { mode: "customer" },
      });
      expect(before.statusCode).toBe(200);

      const logoutRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
        headers: { cookie: `refresh_token=${refreshCookie!.value}` },
      });
      expect(logoutRes.statusCode).toBe(200);

      const authorization = { authorization: `Bearer ${accessToken}` };
      const protectedRead = await app.inject({
        method: "GET",
        url: `/api/v1/business/${new Types.ObjectId().toString()}`,
        headers: authorization,
      });
      const resend = await app.inject({
        method: "POST",
        url: "/api/v1/auth/resend-email-confirmation",
        headers: authorization,
      });
      const setMode = await app.inject({
        method: "POST",
        url: "/api/v1/auth/set-mode",
        headers: authorization,
        payload: { mode: "customer" },
      });

      for (const response of [protectedRead, resend, setMode]) {
        expect(response.statusCode).toBe(401);
        expect(response.headers["content-type"]).toContain(
          "application/problem+json",
        );
        expect(response.json().detail).toBe("Invalid or expired access token");
      }
    });

    it("leaves the other business session able to refresh and call current-user", async () => {
      const app = await getTestApp();
      const email = "logout-peer-biz@test.com";
      const business = await Business.create({
        tradeName: "Logout Peer Biz",
        legalName: "Logout Peer Biz Legal",
        email,
        password: hashedPassword,
        taxNumber: "TAX-LOGOUT-PEER",
        phoneNumber: "1234567890",
        currencyTrade: "USD",
        address: {
          country: "USA",
          state: "CA",
          city: "LA",
          street: "Main St",
          buildingNumber: "123",
          postCode: "90001",
        },
      });

      const first = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password: testPassword },
      });
      const second = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password: testPassword },
      });
      const firstCookie = first.cookies.find(
        (cookie) => cookie.name === "refresh_token",
      );
      const secondCookie = second.cookies.find(
        (cookie) => cookie.name === "refresh_token",
      );
      expect(firstCookie?.value).toBeTruthy();
      expect(secondCookie?.value).toBeTruthy();
      expect(secondCookie!.value).not.toBe(firstCookie!.value);

      for (const cookie of [firstCookie!, secondCookie!]) {
        const beforeLogout = await app.inject({
          method: "POST",
          url: "/api/v1/auth/refresh",
          headers: { cookie: `refresh_token=${cookie.value}` },
        });
        expect(beforeLogout.statusCode).toBe(200);
        expect(beforeLogout.headers["content-type"]).toContain("application/json");
        expect(typeof beforeLogout.json().accessToken).toBe("string");
      }

      const logoutRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
        headers: { cookie: `refresh_token=${secondCookie!.value}` },
      });
      expect(logoutRes.statusCode).toBe(200);
      expect(logoutRes.headers["content-type"]).toContain("application/json");
      expect(logoutRes.json()).toEqual({ message: "Logged out successfully" });
      expect(
        logoutRes.cookies.find((cookie) => cookie.name === "refresh_token")
          ?.value,
      ).toBe("");
      expect(
        logoutRes.cookies.find((cookie) => cookie.name === "auth_mode")?.value,
      ).toBe("");

      const signedOut = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: { cookie: `refresh_token=${secondCookie!.value}` },
      });
      expect(signedOut.statusCode).toBe(401);
      expect(signedOut.headers["content-type"]).toContain(
        "application/problem+json",
      );
      expect(signedOut.json().detail).toBe("Invalid or expired refresh token");
      expect(signedOut.json().accessToken).toBeUndefined();

      const stillIn = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: { cookie: `refresh_token=${firstCookie!.value}` },
      });
      expect(stillIn.statusCode).toBe(200);
      expect(stillIn.headers["content-type"]).toContain("application/json");
      const stillInBody = stillIn.json();
      expect(typeof stillInBody.accessToken).toBe("string");
      expect(stillInBody.user.id).toBe(String(business._id));
      expect(stillInBody.user.type).toBe("business");
      expect(stillInBody.user.sessionId).toBeUndefined();

      const currentUser = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${stillInBody.accessToken}` },
      });
      expect(currentUser.statusCode).toBe(200);
      expect(currentUser.headers["content-type"]).toContain("application/json");
      expect(currentUser.json().user.id).toBe(String(business._id));
      expect(currentUser.json().user.type).toBe("business");

      const stored = await Business.findById(business._id).select(
        "refreshSessionVersion",
      );
      expect(stored?.refreshSessionVersion ?? 0).toBe(0);
    });
  });

  describe("POST /api/v1/auth/refresh", () => {
    it("returns 401 when no refresh token", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
      });

      expect(response.statusCode).toBe(401);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = response.json();
      expect(body.type).toBe("https://restaurant-pos.app/errors/unauthorized");
      expect(body.detail).toBe("No refresh token provided");
      expect(
        response.cookies.find((cookie) => cookie.name === "refresh_token")
          ?.value,
      ).toBe("");
    });

    it("does not treat a body as a validation problem when the cookie is missing", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        payload: { paymentId: "pay-1" },
      });

      expect(response.statusCode).toBe(401);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = response.json();
      expect(body.type).toBe("https://restaurant-pos.app/errors/unauthorized");
      expect(body.detail).toBe("No refresh token provided");
    });

    it("returns 401 for invalid refresh token", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        cookies: { refresh_token: "invalid-token" },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.type).toBe("https://restaurant-pos.app/errors/unauthorized");
      expect(body.detail).toBe("Invalid or expired refresh token");
      expect(
        response.cookies.find((cookie) => cookie.name === "refresh_token")
          ?.value,
      ).toBe("");
    });

    it("returns 200 with new access token when refresh cookie matches session version", async () => {
      const app = await getTestApp();

      await Business.create({
        tradeName: "Refresh OK Biz",
        legalName: "Refresh OK Biz Legal",
        email: "refresh-ok-biz@test.com",
        password: hashedPassword,
        taxNumber: "TAX-REFRESH-OK",
        phoneNumber: "1234567890",
        currencyTrade: "USD",
        address: {
          country: "USA",
          state: "CA",
          city: "LA",
          street: "Main St",
          buildingNumber: "123",
          postCode: "90001",
        },
      });

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "refresh-ok-biz@test.com", password: testPassword },
      });
      expect(loginRes.statusCode).toBe(200);

      const setCookie = loginRes.headers["set-cookie"];
      const lines = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
      const refreshLine = lines.find((l) => l.startsWith("refresh_token="));
      expect(refreshLine).toBeDefined();
      const prefix = "refresh_token=";
      const afterPrefix = refreshLine!.slice(prefix.length);
      const semi = afterPrefix.indexOf(";");
      const refreshVal =
        semi >= 0 ? afterPrefix.slice(0, semi) : afterPrefix;

      const refreshRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: { cookie: `refresh_token=${refreshVal}` },
      });

      expect(refreshRes.statusCode).toBe(200);
      const body = JSON.parse(refreshRes.body);
      expect(body.accessToken).toBeDefined();
      expect(body.user?.type).toBe("business");
      expect(body.user.sessionId).toBeUndefined();
      expect(body.refreshToken).toBeUndefined();
      expect(
        refreshRes.cookies.find((cookie) => cookie.name === "refresh_token"),
      ).toBeUndefined();
    });

    it("returns 401 after a logged-in user account is soft-deleted", async () => {
      const app = await getTestApp();

      const user = await User.create({
        personalDetails: {
          email: "refresh-soft-delete@test.com",
          password: hashedPassword,
          firstName: "Refresh",
          lastName: "Deleted",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          address: {
            country: "USA",
            state: "CA",
            city: "LA",
            street: "Main St",
            buildingNumber: "123",
            postCode: "90001",
          },
          idNumber: "ID-REFRESH-DELETED",
          idType: "Passport",
          username: "refreshdeleted",
        },
      });

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "refresh-soft-delete@test.com", password: testPassword },
      });
      expect(loginRes.statusCode).toBe(200);

      const setCookie = loginRes.headers["set-cookie"];
      const lines = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
      const refreshLine = lines.find((l) => l.startsWith("refresh_token="));
      expect(refreshLine).toBeDefined();
      const prefix = "refresh_token=";
      const afterPrefix = refreshLine!.slice(prefix.length);
      const semi = afterPrefix.indexOf(";");
      const refreshVal = semi >= 0 ? afterPrefix.slice(0, semi) : afterPrefix;

      await User.updateOne(
        { _id: user._id },
        { $set: { deleted: true, deletedAt: new Date() } },
      );

      const refreshRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: { cookie: `refresh_token=${refreshVal}` },
      });

      expect(refreshRes.statusCode).toBe(401);
      expect(refreshRes.json().detail).toBe("User not found");
    });

    it("returns 401 after a logged-in business is closed", async () => {
      const app = await getTestApp();
      const business = await Business.create({
        tradeName: "Refresh Closed Biz",
        legalName: "Refresh Closed Biz Legal",
        email: "refresh-closed-biz@test.com",
        password: hashedPassword,
        taxNumber: "TAX-REFRESH-CLOSED",
        phoneNumber: "1234567890",
        currencyTrade: "USD",
        address: {
          country: "USA",
          state: "CA",
          city: "LA",
          street: "Main St",
          buildingNumber: "123",
          postCode: "90001",
        },
      });

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "refresh-closed-biz@test.com", password: testPassword },
      });
      expect(loginRes.statusCode).toBe(200);

      const setCookie = loginRes.headers["set-cookie"];
      const lines = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
      const refreshLine = lines.find((l) => l.startsWith("refresh_token="));
      expect(refreshLine).toBeDefined();
      const prefix = "refresh_token=";
      const afterPrefix = refreshLine!.slice(prefix.length);
      const semi = afterPrefix.indexOf(";");
      const refreshVal = semi >= 0 ? afterPrefix.slice(0, semi) : afterPrefix;

      await Business.updateOne(
        { _id: business._id },
        { $set: { deleted: true, deletedAt: new Date() } },
      );

      const refreshRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: { cookie: `refresh_token=${refreshVal}` },
      });

      expect(refreshRes.statusCode).toBe(401);
      expect(refreshRes.json().detail).toBe("Business not found");
    });

    it("rejects a closed business access token on a protected route and on the session read", async () => {
      const app = await getTestApp();
      const business = await Business.create({
        tradeName: "Access Closed Biz",
        legalName: "Access Closed Biz Legal",
        email: "access-closed-biz@test.com",
        password: hashedPassword,
        taxNumber: "TAX-ACCESS-CLOSED",
        phoneNumber: "1234567890",
        currencyTrade: "USD",
        address: {
          country: "USA",
          state: "CA",
          city: "LA",
          street: "Main St",
          buildingNumber: "123",
          postCode: "90001",
        },
      });

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "access-closed-biz@test.com", password: testPassword },
      });
      expect(loginRes.statusCode).toBe(200);
      const { accessToken } = JSON.parse(loginRes.body);

      await Business.updateOne(
        { _id: business._id },
        { $set: { deleted: true, deletedAt: new Date() } },
      );

      const venueRead = await app.inject({
        method: "GET",
        url: `/api/v1/business/${business._id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(venueRead.statusCode).toBe(401);

      const sessionRead = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(sessionRead.statusCode).toBe(401);
      expect(sessionRead.json().detail).toBe("Invalid or expired access token");
    });
  });

  describe("refresh session issuance", () => {
    it("returns an access token and a refresh cookie that can be exchanged until that session is revoked", async () => {
      const app = await getTestApp();
      const email = "refresh-session@test.com";
      const user = await User.create({
        personalDetails: {
          email,
          password: hashedPassword,
          firstName: "Refresh",
          lastName: "Session",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          address: {
            country: "USA",
            state: "CA",
            city: "LA",
            street: "Main St",
            buildingNumber: "123",
            postCode: "90001",
          },
          idNumber: "ID-REFRESH-SESSION",
          idType: "Passport",
          username: "refreshsession",
        },
      });

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password: testPassword },
      });

      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.headers["content-type"]).toContain("application/json");
      const loginBody = loginRes.json();
      expect(typeof loginBody.accessToken).toBe("string");
      expect(accessTokenLifetimeSeconds(loginBody.accessToken)).toBe(15 * 60);
      expect(loginBody.user.sessionId).toBeUndefined();
      expect(loginBody.refreshToken).toBeUndefined();

      const refreshCookie = loginRes.cookies.find(
        (cookie) => cookie.name === "refresh_token",
      );
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie!.httpOnly).toBe(true);
      expect(refreshCookie!.sameSite?.toLowerCase()).toBe("lax");
      expect(refreshCookie!.path).toBe("/");
      expect(refreshCookie!.maxAge).toBe(60 * 60 * 24 * 7);
      expect(refreshCookie!.secure).toBeFalsy();
      expect(loginRes.body).not.toContain(refreshCookie!.value);

      const refreshRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: { cookie: `refresh_token=${refreshCookie!.value}` },
      });

      expect(refreshRes.statusCode).toBe(200);
      expect(refreshRes.headers["content-type"]).toContain("application/json");
      const refreshBody = refreshRes.json();
      expect(typeof refreshBody.accessToken).toBe("string");
      expect(accessTokenLifetimeSeconds(refreshBody.accessToken)).toBe(15 * 60);
      expect(refreshBody.user.sessionId).toBeUndefined();
      expect(refreshBody.user.type).toBe("user");
      expect(refreshBody.refreshToken).toBeUndefined();
      expect(refreshRes.body).not.toContain(refreshCookie!.value);
      expect(
        refreshRes.cookies.find((cookie) => cookie.name === "refresh_token"),
      ).toBeUndefined();

      const sessionRead = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${refreshBody.accessToken}` },
      });
      expect(sessionRead.statusCode).toBe(200);
      expect(sessionRead.json().user.sessionId).toBeUndefined();
      expect(sessionRead.json().user.type).toBe("user");

      const stored = await RefreshSession.findOne({
        accountId: user._id,
        accountType: "user",
      });
      expect(stored).not.toBeNull();
      expect(accessTokenSessionId(loginBody.accessToken)).toEqual(
        expect.any(String),
      );
      expect(accessTokenSessionId(refreshBody.accessToken)).toBe(
        accessTokenSessionId(loginBody.accessToken),
      );
      stored!.revoked = true;
      await stored!.save();

      const revoked = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: { cookie: `refresh_token=${refreshCookie!.value}` },
      });

      expect(revoked.statusCode).toBe(401);
      expect(revoked.headers["content-type"]).toContain(
        "application/problem+json",
      );
      expect(revoked.json().detail).toBe("Invalid or expired refresh token");
      const cleared = revoked.cookies.find(
        (cookie) => cookie.name === "refresh_token",
      );
      expect(cleared).toBeDefined();
      expect(cleared!.value).toBe("");
    });

    it("returns the current failure and creates no refresh session for a wrong password", async () => {
      const app = await getTestApp();
      await User.create({
        personalDetails: {
          email: "wrong-password@test.com",
          password: hashedPassword,
          firstName: "Wrong",
          lastName: "Password",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          address: {
            country: "USA",
            state: "CA",
            city: "LA",
            street: "Main St",
            buildingNumber: "123",
            postCode: "90001",
          },
          idNumber: "ID-WRONG-PASSWORD",
          idType: "Passport",
          username: "wrongpassword",
        },
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "wrong-password@test.com", password: "not-the-password" },
      });

      expect(response.statusCode).toBe(401);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      expect(response.json().detail).toBe("Invalid credentials");
      expect(response.json().accessToken).toBeUndefined();
      expect(
        response.cookies.find((cookie) => cookie.name === "refresh_token"),
      ).toBeUndefined();
      expect(await RefreshSession.countDocuments()).toBe(0);
    });

    it("keeps both refresh cookies live after a second sign-in", async () => {
      const app = await getTestApp();
      const email = "two-sessions@test.com";
      await User.create({
        personalDetails: {
          email,
          password: hashedPassword,
          firstName: "Two",
          lastName: "Sessions",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          address: {
            country: "USA",
            state: "CA",
            city: "LA",
            street: "Main St",
            buildingNumber: "123",
            postCode: "90001",
          },
          idNumber: "ID-TWO-SESSIONS",
          idType: "Passport",
          username: "twosessions",
        },
      });

      const first = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password: testPassword },
      });
      const second = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password: testPassword },
      });
      const firstCookie = first.cookies.find(
        (cookie) => cookie.name === "refresh_token",
      );
      const secondCookie = second.cookies.find(
        (cookie) => cookie.name === "refresh_token",
      );
      expect(firstCookie?.value).toBeTruthy();
      expect(secondCookie?.value).toBeTruthy();
      expect(secondCookie!.value).not.toBe(firstCookie!.value);
      expect(await RefreshSession.countDocuments()).toBe(2);

      for (const cookie of [firstCookie!, secondCookie!]) {
        const refreshRes = await app.inject({
          method: "POST",
          url: "/api/v1/auth/refresh",
          headers: { cookie: `refresh_token=${cookie.value}` },
        });
        expect(refreshRes.statusCode).toBe(200);
        expect(refreshRes.json().accessToken).toEqual(expect.any(String));
        expect(refreshRes.json().user.sessionId).toBeUndefined();
      }
    });

    it("refuses an unknown refresh session and clears the cookie", async () => {
      const app = await getTestApp();
      const email = "unknown-session@test.com";
      const user = await User.create({
        personalDetails: {
          email,
          password: hashedPassword,
          firstName: "Unknown",
          lastName: "Session",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          address: {
            country: "USA",
            state: "CA",
            city: "LA",
            street: "Main St",
            buildingNumber: "123",
            postCode: "90001",
          },
          idNumber: "ID-UNKNOWN-SESSION",
          idType: "Passport",
          username: "unknownsession",
        },
      });

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password: testPassword },
      });
      const refreshCookie = loginRes.cookies.find(
        (cookie) => cookie.name === "refresh_token",
      );
      expect(refreshCookie?.value).toBeTruthy();
      await RefreshSession.deleteMany({ accountId: user._id });

      const refreshRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: { cookie: `refresh_token=${refreshCookie!.value}` },
      });

      expect(refreshRes.statusCode).toBe(401);
      expect(refreshRes.headers["content-type"]).toContain(
        "application/problem+json",
      );
      expect(refreshRes.json().detail).toBe("Invalid or expired refresh token");
      expect(
        refreshRes.cookies.find((cookie) => cookie.name === "refresh_token")
          ?.value,
      ).toBe("");
    });

    it("refuses an expired refresh session and clears the cookie", async () => {
      const app = await getTestApp();
      const email = "expired-session@test.com";
      const user = await User.create({
        personalDetails: {
          email,
          password: hashedPassword,
          firstName: "Expired",
          lastName: "Session",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          address: {
            country: "USA",
            state: "CA",
            city: "LA",
            street: "Main St",
            buildingNumber: "123",
            postCode: "90001",
          },
          idNumber: "ID-EXPIRED-SESSION",
          idType: "Passport",
          username: "expiredsession",
        },
      });

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password: testPassword },
      });
      const refreshCookie = loginRes.cookies.find(
        (cookie) => cookie.name === "refresh_token",
      );
      expect(refreshCookie?.value).toBeTruthy();
      await RefreshSession.updateOne(
        { accountId: user._id },
        { $set: { expiresAt: new Date(Date.now() - 1000) } },
      );

      const refreshRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: { cookie: `refresh_token=${refreshCookie!.value}` },
      });

      expect(refreshRes.statusCode).toBe(401);
      expect(refreshRes.headers["content-type"]).toContain(
        "application/problem+json",
      );
      expect(refreshRes.json().detail).toBe("Invalid or expired refresh token");
      expect(
        refreshRes.cookies.find((cookie) => cookie.name === "refresh_token")
          ?.value,
      ).toBe("");
    });
  });

  describe("access token refresh session", () => {
    async function signInCustomer(email: string, username: string, idNumber: string) {
      const user = await User.create({
        personalDetails: {
          email,
          password: hashedPassword,
          emailVerified: true,
          firstName: "Access",
          lastName: "Session",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          address: {
            country: "USA",
            state: "CA",
            city: "LA",
            street: "Main St",
            buildingNumber: "123",
            postCode: "90001",
          },
          idNumber,
          idType: "Passport",
          username,
        },
      });
      const app = await getTestApp();
      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password: testPassword },
      });
      expect(loginRes.statusCode).toBe(200);
      return {
        app,
        user,
        accessToken: loginRes.json().accessToken as string,
      };
    }

    async function expectAccessRefused(
      app: Awaited<ReturnType<typeof getTestApp>>,
      accessToken: string,
    ) {
      const authorization = { authorization: `Bearer ${accessToken}` };
      const currentUser = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: authorization,
      });
      const protectedRead = await app.inject({
        method: "GET",
        url: `/api/v1/business/${new Types.ObjectId().toString()}`,
        headers: authorization,
      });
      const resend = await app.inject({
        method: "POST",
        url: "/api/v1/auth/resend-email-confirmation",
        headers: authorization,
      });
      const setMode = await app.inject({
        method: "POST",
        url: "/api/v1/auth/set-mode",
        headers: authorization,
        payload: { mode: "customer" },
      });

      for (const response of [currentUser, protectedRead, resend, setMode]) {
        expect(response.statusCode).toBe(401);
        expect(response.headers["content-type"]).toContain(
          "application/problem+json",
        );
        expect(response.json().detail).toBe("Invalid or expired access token");
      }
    }

    it("refuses a missing refresh session", async () => {
      const { app, user, accessToken } = await signInCustomer(
        "missing-access-session@test.com",
        "missingaccess",
        "ID-MISSING-ACCESS",
      );
      await RefreshSession.deleteMany({ accountId: user._id });
      await expectAccessRefused(app, accessToken);
    });

    it("refuses an expired refresh session", async () => {
      const { app, user, accessToken } = await signInCustomer(
        "expired-access-session@test.com",
        "expiredaccess",
        "ID-EXPIRED-ACCESS",
      );
      await RefreshSession.updateOne(
        { accountId: user._id },
        { $set: { expiresAt: new Date(Date.now() - 1000) } },
      );
      await expectAccessRefused(app, accessToken);
    });

    it("refuses a generation-mismatched refresh session and accepts one issued after", async () => {
      const { app, user, accessToken } = await signInCustomer(
        "generation-access-session@test.com",
        "generationaccess",
        "ID-GENERATION-ACCESS",
      );
      await User.updateOne(
        { _id: user._id },
        { $inc: { refreshSessionVersion: 1 } },
      );
      await expectAccessRefused(app, accessToken);

      const nextLogin = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "generation-access-session@test.com",
          password: testPassword,
        },
      });
      expect(nextLogin.statusCode).toBe(200);
      const nextToken = nextLogin.json().accessToken as string;
      const currentUser = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${nextToken}` },
      });
      expect(currentUser.statusCode).toBe(200);
      expect(currentUser.json().user.sessionId).toBeUndefined();

      const protectedRead = await app.inject({
        method: "GET",
        url: `/api/v1/business/${user._id}`,
        headers: { authorization: `Bearer ${nextToken}` },
      });
      expect(protectedRead.statusCode).toBe(403);

      const setMode = await app.inject({
        method: "POST",
        url: "/api/v1/auth/set-mode",
        headers: { authorization: `Bearer ${nextToken}` },
        payload: { mode: "customer" },
      });
      expect(setMode.statusCode).toBe(200);
      expect(setMode.json().mode).toBe("customer");
    });

    it("refuses an access token bound to another account's refresh session", async () => {
      const first = await signInCustomer(
        "bound-access-a@test.com",
        "boundaccessa",
        "ID-BOUND-ACCESS-A",
      );
      const second = await signInCustomer(
        "bound-access-b@test.com",
        "boundaccessb",
        "ID-BOUND-ACCESS-B",
      );
      const token = first.app.jwt.sign({
        id: String(first.user._id),
        email: "bound-access-a@test.com",
        type: "user",
        role: "Customer",
        sessionId: accessTokenSessionId(second.accessToken),
      });
      await expectAccessRefused(first.app, token);
    });

    it("refuses a bearer with no session id", async () => {
      const { app, user } = await signInCustomer(
        "no-session-access@test.com",
        "nosessionaccess",
        "ID-NO-SESSION-ACCESS",
      );
      const token = app.jwt.sign({
        id: String(user._id),
        email: "no-session-access@test.com",
        type: "user",
        role: "Customer",
      });
      await expectAccessRefused(app, token);
    });
  });

  describe("GET /api/v1/auth/me", () => {
    it("refuses an access session after the user is soft-deleted", async () => {
      const app = await getTestApp();
      const user = await User.create({
        personalDetails: {
          email: "me-deleted@test.com",
          password: hashedPassword,
          firstName: "Me",
          lastName: "Deleted",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          address: {
            country: "USA",
            state: "CA",
            city: "LA",
            street: "Main St",
            buildingNumber: "123",
            postCode: "90001",
          },
          idNumber: "ID-ME-DELETED",
          idType: "Passport",
          username: "medeleted",
        },
      });

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "me-deleted@test.com", password: testPassword },
      });
      expect(loginRes.statusCode).toBe(200);
      const { accessToken } = JSON.parse(loginRes.body);

      await User.updateOne(
        { _id: user._id },
        { $set: { deleted: true, deletedAt: new Date(), deletedBy: user._id } },
      );

      const sessionRead = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(sessionRead.statusCode).toBe(401);
      expect(sessionRead.headers["content-type"]).toContain("application/problem+json");
      expect(sessionRead.json().detail).toBe("Invalid or expired access token");

      const protectedRead = await app.inject({
        method: "GET",
        url: `/api/v1/business/${user._id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(protectedRead.statusCode).toBe(401);
      expect(protectedRead.headers["content-type"]).toContain("application/problem+json");
      expect(protectedRead.json().detail).toBe("Invalid or expired access token");
    });

    it("returns user session with valid token", async () => {
      const app = await getTestApp();

      await Business.create({
        tradeName: "Me Test Business",
        legalName: "Me Test Business Legal",
        email: "me-business@test.com",
        password: hashedPassword,
        taxNumber: "TAX-BUS-002",
        phoneNumber: "1234567890",
        currencyTrade: "USD",
        address: {
          country: "USA",
          state: "CA",
          city: "LA",
          street: "Main St",
          buildingNumber: "123",
          postCode: "90001",
        },
      });

      const loginResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "me-business@test.com", password: testPassword },
      });

      const { accessToken } = JSON.parse(loginResponse.body);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.user).toBeDefined();
      expect(body.user.type).toBe("business");
    });

    it("returns 401 without token", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
      });

      expect(response.statusCode).toBe(401);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = response.json();
      expect(body.type).toBe("https://restaurant-pos.app/errors/unauthorized");
      expect(body.detail).toBe("No access token provided");
    });

    it("does not treat a stray query as a validation problem", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me?paymentId=pay-1",
      });

      expect(response.statusCode).toBe(401);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = response.json();
      expect(body.type).toBe("https://restaurant-pos.app/errors/unauthorized");
      expect(body.detail).toBe("No access token provided");
    });

    it("returns 401 for invalid token", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: "Bearer invalid-token" },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.type).toBe("https://restaurant-pos.app/errors/unauthorized");
      expect(body.detail).toBe("Invalid or expired access token");
    });
  });

  describe("POST /api/v1/auth/set-mode", () => {
    it("refuses an access session after the user is soft-deleted", async () => {
      const app = await getTestApp();
      const user = await User.create({
        personalDetails: {
          email: "set-mode-deleted@test.com",
          password: hashedPassword,
          firstName: "Mode",
          lastName: "Deleted",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          address: {
            country: "USA",
            state: "CA",
            city: "LA",
            street: "Main St",
            buildingNumber: "123",
            postCode: "90001",
          },
          idNumber: "ID-SET-MODE-DELETED",
          idType: "Passport",
          username: "setmodedeleted",
        },
      });

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "set-mode-deleted@test.com", password: testPassword },
      });
      expect(loginRes.statusCode).toBe(200);
      const { accessToken } = JSON.parse(loginRes.body);

      await User.updateOne(
        { _id: user._id },
        { $set: { deleted: true, deletedAt: new Date(), deletedBy: user._id } },
      );

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/set-mode",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { mode: "customer" },
      });

      expect(response.statusCode).toBe(401);
      expect(response.headers["content-type"]).toContain("application/problem+json");
      expect(response.json().detail).toBe("Invalid or expired access token");
    });

    it("refuses an access session after the business is closed", async () => {
      const app = await getTestApp();
      const business = await Business.create({
        tradeName: "Set Mode Closed Biz",
        legalName: "Set Mode Closed Biz Legal",
        email: "set-mode-closed-biz@test.com",
        password: hashedPassword,
        taxNumber: "TAX-SET-MODE-CLOSED",
        phoneNumber: "1234567890",
        currencyTrade: "USD",
        address: {
          country: "USA",
          state: "CA",
          city: "LA",
          street: "Main St",
          buildingNumber: "123",
          postCode: "90001",
        },
      });

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "set-mode-closed-biz@test.com", password: testPassword },
      });
      expect(loginRes.statusCode).toBe(200);
      const { accessToken } = JSON.parse(loginRes.body);

      await Business.updateOne(
        { _id: business._id },
        { $set: { deleted: true, deletedAt: new Date(), deletedBy: business._id } },
      );

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/set-mode",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { mode: "customer" },
      });

      expect(response.statusCode).toBe(401);
      expect(response.headers["content-type"]).toContain("application/problem+json");
      expect(response.json().detail).toBe("Invalid or expired access token");
    });

    it("returns 401 without token", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/set-mode",
        payload: { mode: "customer" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 400 for invalid mode", async () => {
      const app = await getTestApp();

      await User.create({
        personalDetails: {
          email: "mode-user@test.com",
          password: hashedPassword,
          firstName: "Mode",
          lastName: "User",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          address: {
            country: "USA",
            state: "CA",
            city: "LA",
            street: "Main St",
            buildingNumber: "123",
            postCode: "90001",
          },
          idNumber: "ID123458",
          idType: "Passport",
          username: "modeuser",
        },
        allUserRoles: ["Customer"],
      });

      const loginResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "mode-user@test.com", password: testPassword },
      });

      const { accessToken } = JSON.parse(loginResponse.body);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/set-mode",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { mode: "invalid" },
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = response.json();
      expect(body.type).toBe("https://restaurant-pos.app/errors/validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "mode" })]),
      );
    });

    it("sets customer mode successfully", async () => {
      const app = await getTestApp();

      await User.create({
        personalDetails: {
          email: "customer-mode@test.com",
          password: hashedPassword,
          firstName: "Customer",
          lastName: "Mode",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          address: {
            country: "USA",
            state: "CA",
            city: "LA",
            street: "Main St",
            buildingNumber: "123",
            postCode: "90001",
          },
          idNumber: "ID123459",
          idType: "Passport",
          username: "customermode",
        },
        allUserRoles: ["Customer"],
      });

      const loginResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "customer-mode@test.com", password: testPassword },
      });

      const { accessToken } = JSON.parse(loginResponse.body);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/set-mode",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { mode: "customer" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.mode).toBe("customer");
    });
  });

  describe("GET /api/v1/auth/mode", () => {
    it("returns default mode as customer", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/mode",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.mode).toBe("customer");
    });

    it("ignores a stray query and stays without a request DTO", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/mode?paymentId=pay-1",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ mode: "customer" });
    });
  });

  describe("request DTO contract", () => {
    it("rejects paymentId on the login body", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "a@b.com",
          password: "x",
          paymentId: "pay-1",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = response.json();
      expect(body.type).toBe("https://restaurant-pos.app/errors/validation");
      expect(body.status).toBe(400);
      expect(body.detail).toBe("Request body is invalid");
      expect(body.instance).toBe("/api/v1/auth/login");
      expect(Array.isArray(body.errors)).toBe(true);
    });

    it("rejects a session id and refreshSessionVersion", async () => {
      const app = await getTestApp();

      for (const field of ["sessionId", "refreshSessionVersion"]) {
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: { email: "a@b.com", password: "x", [field]: "owned" },
        });

        expect(response.statusCode, response.body).toBe(400);
        expect(response.headers["content-type"]).toContain(
          "application/problem+json",
        );
        expect(response.json().type).toBe(
          "https://restaurant-pos.app/errors/validation",
        );
      }
    });

    it("rejects unknown keys with a validation problem document", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "a@b.com", password: "x", isAdmin: true },
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = response.json();
      expect(body.type).toBe("https://restaurant-pos.app/errors/validation");
      expect(body.detail).toBe("Request body is invalid");
    });

    it("rejects server-owned fields on signup", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/signup",
        payload: {
          email: "server-owned@example.com",
          password: "TestPassword123!",
          emailVerified: true,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = response.json();
      expect(body.type).toBe("https://restaurant-pos.app/errors/validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "" })]),
      );
    });

    it("rejects an invalid signup email with a field path", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/signup",
        payload: { email: "not-an-email", password: "TestPassword123!" },
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = response.json();
      expect(body.type).toBe("https://restaurant-pos.app/errors/validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "email" })]),
      );
    });

    it("normalizes the login email (trim + lowercase)", async () => {
      const app = await getTestApp();

      await User.create({
        personalDetails: {
          email: "normalized@test.com",
          password: hashedPassword,
          firstName: "Norm",
          lastName: "Alized",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          address: {
            country: "USA",
            state: "CA",
            city: "LA",
            street: "Main St",
            buildingNumber: "123",
            postCode: "90001",
          },
          idNumber: "ID-NORM",
          idType: "Passport",
          username: "normalized",
        },
        allUserRoles: ["Customer"],
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "  Normalized@Test.COM ", password: testPassword },
      });

      expect(response.statusCode).toBe(200);
    });
  });
});

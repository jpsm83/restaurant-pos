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
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid credentials");
    });

    it("returns 400 for missing email/password", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
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
  });

  describe("POST /api/v1/auth/logout", () => {
    it("clears session and returns success", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Logged out successfully");
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
      const body = JSON.parse(response.body);
      expect(body.message).toBe("No refresh token provided");
    });

    it("returns 401 for invalid refresh token", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        cookies: { refresh_token: "invalid-token" },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid or expired refresh token");
    });
  });

  describe("GET /api/v1/auth/me", () => {
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
      const body = JSON.parse(response.body);
      expect(body.message).toBe("No access token provided");
    });

    it("returns 401 for invalid token", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: "Bearer invalid-token" },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid or expired access token");
    });
  });

  describe("POST /api/v1/auth/set-mode", () => {
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
  });
});

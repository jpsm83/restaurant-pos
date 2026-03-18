/**
 * Authentication helpers for tests
 */

import type { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import Business from "../../src/models/business.js";
import User from "../../src/models/user.js";
import Employee from "../../src/models/employee.js";

export interface TestBusinessCredentials {
  email: string;
  password: string;
  businessId: string;
}

export interface TestUserCredentials {
  email: string;
  password: string;
  userId: string;
  employeeId?: string;
  businessId?: string;
}

/**
 * Create a test business account and return credentials
 */
export async function createTestBusiness(
  overrides: Partial<{ email: string; password: string; businessTradeName: string }> = {}
): Promise<TestBusinessCredentials> {
  const email = overrides.email ?? `business-${Date.now()}@test.com`;
  const password = overrides.password ?? "TestPassword123!";
  const hashedPassword = await bcrypt.hash(password, 10);

  const business = await Business.create({
    email,
    password: hashedPassword,
    businessTradeName: overrides.businessTradeName ?? "Test Business",
    address: {
      country: "Test Country",
      state: "Test State",
      city: "Test City",
      street: "Test Street",
      buildingNumber: "123",
      postCode: "12345",
    },
  });

  return {
    email,
    password,
    businessId: business._id.toString(),
  };
}

/**
 * Create a test user account and return credentials
 */
export async function createTestUser(
  overrides: Partial<{ email: string; password: string; firstName: string; lastName: string }> = {}
): Promise<TestUserCredentials> {
  const email = overrides.email ?? `user-${Date.now()}@test.com`;
  const password = overrides.password ?? "TestPassword123!";
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    personalDetails: {
      email,
      firstName: overrides.firstName ?? "Test",
      lastName: overrides.lastName ?? "User",
    },
    password: hashedPassword,
  });

  return {
    email,
    password,
    userId: user._id.toString(),
  };
}

/**
 * Create a test employee linked to a user and business
 */
export async function createTestEmployee(
  businessId: string,
  userId: string,
  role: string = "Waiter"
): Promise<string> {
  const employee = await Employee.create({
    businessId,
    userId,
    currentShiftRole: role,
    grossHourlySalary: 15,
    netMonthlySalary: 2000,
  });

  // Update user with employee details
  await User.findByIdAndUpdate(userId, {
    employeeDetails: employee._id,
  });

  return employee._id.toString();
}

/**
 * Login and get access token for a business account
 */
export async function loginAsBusiness(
  app: FastifyInstance,
  credentials: TestBusinessCredentials
): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: {
      email: credentials.email,
      password: credentials.password,
    },
  });

  if (response.statusCode !== 200) {
    throw new Error(`Login failed: ${response.body}`);
  }

  const body = response.json<{ accessToken: string }>();
  return body.accessToken;
}

/**
 * Login and get access token for a user account
 */
export async function loginAsUser(
  app: FastifyInstance,
  credentials: TestUserCredentials
): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: {
      email: credentials.email,
      password: credentials.password,
    },
  });

  if (response.statusCode !== 200) {
    throw new Error(`Login failed: ${response.body}`);
  }

  const body = response.json<{ accessToken: string }>();
  return body.accessToken;
}

/**
 * Create authorization header with Bearer token
 */
export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

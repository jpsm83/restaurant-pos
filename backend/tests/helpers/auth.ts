/**
 * Authentication helpers for tests
 */

import type { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import User from "../../src/models/user.ts";
import Employee from "../../src/models/employee.ts";

export interface TestUserCredentials {
  email: string;
  password: string;
  userId: string;
  employeeId?: string;
  businessId?: string;
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
      password: hashedPassword,
      firstName: overrides.firstName ?? "Test",
      lastName: overrides.lastName ?? "User",
    },
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

  return employee._id.toString();
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

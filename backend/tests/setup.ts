/**
 * Global test setup file
 * Runs before each test file
 * Uses MongoMemoryReplSet to support MongoDB transactions
 */

// Load environment variables from .env file
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), "..", ".env") });

import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/server.ts";
import type { AuthSession } from "../src/auth/types.ts";

let mongoReplSet: MongoMemoryReplSet | null = null;
let testApp: FastifyInstance | null = null;

/**
 * Get the test Fastify app instance (creates one if needed)
 */
export async function getTestApp(): Promise<FastifyInstance> {
  if (!testApp) {
    testApp = await buildApp({ logger: false, skipDb: true });
  }
  return testApp;
}

/**
 * Generate a valid JWT token for testing auth-protected routes
 * @param session - The auth session to encode in the token
 * @returns Bearer token string ready to use in Authorization header
 */
export async function generateTestToken(session: AuthSession): Promise<string> {
  const app = await getTestApp();
  const token = app.jwt.sign(session);
  return `Bearer ${token}`;
}

/**
 * Force creation of a fresh app (useful when mocks need to be applied)
 * Call this in beforeAll of test files that use vi.mock
 */
export async function resetTestApp(): Promise<void> {
  if (testApp) {
    await testApp.close();
    testApp = null;
  }
}

/**
 * Start MongoDB Memory Replica Set and connect mongoose
 * Replica set is required for transaction support
 */
beforeAll(async () => {
  // Create in-memory MongoDB replica set for transaction support
  mongoReplSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  const mongoUri = mongoReplSet.getUri();
  
  // Connect mongoose to in-memory replica set
  await mongoose.connect(mongoUri);
});

/**
 * Clean up collections after each test
 */
afterEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
});

/**
 * Disconnect and stop MongoDB Memory Replica Set
 */
afterAll(async () => {
  if (testApp) {
    await testApp.close();
    testApp = null;
  }
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  if (mongoReplSet) {
    await mongoReplSet.stop();
  }
});

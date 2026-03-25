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
 * Wait until the in-memory replica set has elected a PRIMARY.
 * Avoids intermittent transaction / catalog errors right after `connect()`.
 */
async function waitForReplicaSetPrimary(
  maxWaitMs = 30_000,
  pollMs = 50,
) {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Mongoose has no database handle after connect");
  }
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    try {
      const status = (await db.admin().command({ replSetGetStatus: 1 })) as {
        members?: Array<{ stateStr?: string }>;
      };
      const hasPrimary =
        Array.isArray(status.members) &&
        status.members.some((m) => m.stateStr === "PRIMARY");
      if (hasPrimary) {
        await db.admin().command({ ping: 1 });
        return;
      }
    } catch {
      // Repl set or command not ready yet
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(
    `MongoDB replica set: no PRIMARY after ${maxWaitMs}ms (transactions need a primary)`,
  );
}

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
  await waitForReplicaSetPrimary();
  // In-memory mongo defaults to very short lock waits; under CI load this spuriously fails txns/tests.
  try {
    await mongoose.connection.db?.admin().command({
      setParameter: 1,
      maxTransactionLockRequestTimeoutMillis: 500,
    } as Record<string, unknown>);
  } catch {
    // Non-fatal if repl set build forbids setParameter
  }
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

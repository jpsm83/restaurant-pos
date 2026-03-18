/**
 * App builder helper for tests
 */

import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/server.js";

let cachedApp: FastifyInstance | null = null;

/**
 * Get or create the test application instance.
 * The app is cached to avoid recreating it for each test.
 * Database connection is handled by setup.ts using MongoDB Memory Server.
 */
export async function getTestApp(): Promise<FastifyInstance> {
  if (!cachedApp) {
    cachedApp = await buildApp({
      logger: false, // Disable logging in tests
      skipDb: true,  // DB is connected in setup.ts
    });
  }
  return cachedApp;
}

/**
 * Close the test application.
 * Call this in afterAll if needed.
 */
export async function closeTestApp(): Promise<void> {
  if (cachedApp) {
    await cachedApp.close();
    cachedApp = null;
  }
}

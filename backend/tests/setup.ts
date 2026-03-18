/**
 * Global test setup file
 * Runs before each test file
 */

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { beforeAll, afterAll, afterEach } from "vitest";

let mongoServer: MongoMemoryServer | null = null;

/**
 * Start MongoDB Memory Server and connect mongoose
 */
beforeAll(async () => {
  // Create in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Connect mongoose to in-memory database
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
 * Disconnect and stop MongoDB Memory Server
 */
afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

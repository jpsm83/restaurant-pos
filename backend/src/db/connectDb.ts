/**
 * connectDb — MongoDB connection singleton helper
 *
 * Ensures a single, reusable connection to MongoDB and avoids opening
 * multiple connections per request (e.g. in serverless). Idempotent:
 * if already connected or connecting, it returns without reconnecting.
 * Necessary for stable DB access in API routes and server actions.
 */

import mongoose from "mongoose";

/**
 * Connects to MongoDB if not already connected. Safe to call repeatedly.
 * Uses restaurantPos db and bufferCommands for serverless compatibility.
 */
const connectDb = async () => {
  // Read env at call-time (not module load time), so `dotenv` setup in `server.ts`
  // has a chance to populate `process.env` before we attempt to connect.
  const mongodbUri = process.env.MONGODB_URI;

  if (!mongodbUri) {
    throw new Error("MONGODB_URI is not defined");
  }

  const connectionState = mongoose.connection.readyState;

  /** 1 = connected; skip to avoid duplicate connection. */
  if (connectionState === 1) {
    console.log("Connection already established");
    return;
  }

  /** 2 = connecting; skip to avoid concurrent connect attempts. */
  if (connectionState === 2) {
    console.log("Connection is connecting");
    return;
  }

  try {
    await mongoose.connect(mongodbUri, {
      dbName: "restaurantPos",
      bufferCommands: true,
    });
    console.log("Connection established");
  } catch (error) {
    console.error("Error: ", error);
    throw new Error("Error: ", error as Error);
  }
};

export default connectDb;

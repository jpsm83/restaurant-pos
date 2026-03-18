import mongoose from "mongoose";

export async function connectDb(): Promise<void> {
  const state = mongoose.connection.readyState;

  // 1 = connected
  if (state === 1) return;
  // 2 = connecting
  if (state === 2) return;

  if (!process.env.MONGODB_URI) {
    throw new Error("Missing MONGODB_URI");
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: "restaurant-pos-api",
    bufferCommands: false,
  });
}

export { mongoose };


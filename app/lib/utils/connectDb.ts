import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

const connectDb = async () => {
  const connectionState = mongoose.connection.readyState;

  if (connectionState === 1) {
    console.log("Connection already established");
    return;
  }

  if (connectionState === 2) {
    console.log("Connection is connecting");
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI!, {
      dbName: "restaurant-pos-api",
      bufferCommands: true,
    });
    console.log("Connection established");
  } catch (error: any) {
    console.error("Error: ", error);
    throw new Error("Error: ", error);
  }
};

export default connectDb;

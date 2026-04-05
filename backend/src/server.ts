// Load environment variables from .env file in project root
import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const currentFileDir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(currentFileDir, "..", "..", ".env") });

import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";

import connectDb from "./db/connectDb.ts";
import { registerV1Routes } from "./routes/v1/index.ts";
import { toHttpError, type HttpErrorShape } from "./utils/httpError.ts";
import { AUTH_CONFIG } from "./auth/config.ts";
import { buildCorsOptions } from "./config/cors.ts";
import liveConnectionRegistry from "./communications/live/connectionRegistry.ts";
import { registerLiveInAppBridge } from "./communications/live/liveBridge.ts";

export interface BuildAppOptions {
  logger?: boolean;
  skipDb?: boolean;
}

/**
 * Validate required environment variables
 */
function validateEnv() {
  if (!AUTH_CONFIG.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined");
  }

  if (!AUTH_CONFIG.REFRESH_SECRET) {
    throw new Error("REFRESH_SECRET is not defined");
  }
}

/**
 * Build and configure the Fastify application.
 * Exported for use in tests via inject().
 */
export async function buildApp(
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const { logger = true, skipDb = false } = options;

  validateEnv();

  const server = Fastify({ logger });

  /**
   * Global error handler
   */
  server.setErrorHandler((err, _req, reply) => {
    const httpErr: HttpErrorShape = toHttpError(err);

    server.log.error(err);

    reply
      .code(httpErr.statusCode)
      .type("application/json")
      .send({ message: httpErr.message });
  });

  /**
   * Register plugins
   */
  await server.register(jwt, {
    secret: AUTH_CONFIG.JWT_SECRET,
  });

  await server.register(cookie, {
    secret: AUTH_CONFIG.REFRESH_SECRET,
    parseOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  });

  await server.register(cors, buildCorsOptions(process.env));

  await server.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      // Some flows (e.g. purchase receipts) upload multiple files in one request.
      files: 10,
      fields: 30,
    },
  });

  await server.register(websocket);

  /**
   * Health check
   */
  server.get("/health", async () => {
    return { ok: true };
  });

  /**
   * Database connection
   */
  if (!skipDb) {
    const hasMongo = Boolean(process.env.MONGODB_URI);

    if (!hasMongo) {
      server.log.warn("MONGODB_URI not set; DB-backed routes may fail.");
    } else {
      try {
        await connectDb();
        server.log.info("Database connected");
      } catch (err) {
        server.log.error("Database connection failed");
        process.exit(1);
      }
    }
  }

  /**
   * Routes
   */
  await server.register(registerV1Routes, { prefix: "/api/v1" });

  registerLiveInAppBridge(server);

  server.addHook("onClose", async () => {
    liveConnectionRegistry.stopHeartbeat();
    liveConnectionRegistry.clearAllConnections();
  });

  return server;
}

/**
 * Start server (only when running directly)
 */
async function main() {
  const server = await buildApp();

  const port = Number(process.env.PORT) || 4000;
  const host = process.env.HOST || "0.0.0.0";

  try {
    await server.ready();
    await server.listen({ port, host });

    server.log.info(`🚀 Server running at http://${host}:${port}`);
  } catch (err) {
    server.log.error({ err }, "Failed to start server");
    process.exit(1);
  }

  /**
   * Graceful shutdown
   */
  const closeGracefully = async () => {
    server.log.info("Shutting down server...");
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", closeGracefully);
  process.on("SIGTERM", closeGracefully);
}

/**
 * Run only if not in test environment
 */
const isTest = process.env.VITEST === "true" || process.env.NODE_ENV === "test";

if (!isTest) {
  main().catch((err) => {
    console.error("Unhandled startup error:", err as Error);
    process.exit(1);
  });
}

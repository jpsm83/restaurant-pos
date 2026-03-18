import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import { connectDb } from "./db/connectDb.js";
import { registerV1Routes } from "./routes/v1/index.js";
import { toHttpError, type HttpErrorShape } from "./utils/httpError.js";
import { AUTH_CONFIG } from "./auth/config.js";

export interface BuildAppOptions {
  logger?: boolean;
  skipDb?: boolean;
}

/**
 * Build and configure the Fastify application.
 * Exported for use in tests via inject().
 */
export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const { logger = true, skipDb = false } = options;

  const server = Fastify({ logger });

  server.setErrorHandler((err, _req, reply) => {
    const httpErr: HttpErrorShape = toHttpError(err);
    reply
      .code(httpErr.statusCode)
      .type("application/json")
      .send({ message: httpErr.message });
  });

  await server.register(jwt, {
    secret: AUTH_CONFIG.JWT_SECRET,
  });

  await server.register(cookie, {
    secret: AUTH_CONFIG.REFRESH_SECRET,
    parseOptions: {},
  });

  await server.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  });

  server.get("/health", async () => {
    return { ok: true };
  });

  // Connect to DB unless skipDb is true (for tests) or MONGODB_URI is not set
  if (!skipDb) {
    const hasMongo = Boolean(process.env.MONGODB_URI);
    if (hasMongo) {
      await connectDb();
    } else {
      server.log.warn("MONGODB_URI not set; DB-backed routes will fail.");
    }
  }

  await server.register(registerV1Routes, { prefix: "/api/v1" });

  return server;
}

// Only start the server if this file is run directly (not imported for tests)
async function main() {
  const server = await buildApp();
  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? "0.0.0.0";
  await server.listen({ port, host });
  console.log(`Server running at http://${host}:${port}`);
}

// Check if running as main module (not during tests)
const isTest = process.env.VITEST === "true" || process.env.NODE_ENV === "test";
const scriptPath = process.argv[1]?.replace(/\\/g, "/").toLowerCase();
const isServerScript = scriptPath?.includes("server.ts") || scriptPath?.includes("server.js");

if (!isTest && isServerScript) {
  main().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}


/**
 * Sentry must load before Fastify. The dev and start scripts import this file
 * with Node's `--import` flag so auto-instrumentation patches modules first.
 */
import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

const currentFileDir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(currentFileDir, "..", "..", ".env") });

const isTest = process.env.VITEST === "true" || process.env.NODE_ENV === "test";
const dsn = process.env.SENTRY_DSN;
const isProduction = process.env.NODE_ENV === "production";

if (!isTest && dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    release: process.env.SENTRY_RELEASE || "restaurant-pos-backend@1.0.0",
    integrations: [nodeProfilingIntegration()],
    // Full rate locally so a verification request is kept. 10% in production.
    tracesSampleRate: isProduction ? 0.1 : 1,
    profileSessionSampleRate: isProduction ? 0.1 : 1,
  });
}

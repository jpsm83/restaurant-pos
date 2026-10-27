/**
 * Sentry must load before Fastify. The dev and start scripts import this file
 * with Node's `--import` flag so auto-instrumentation patches modules first.
 */
import { createRequire } from "node:module";
import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import * as Sentry from "@sentry/node";

import {
  buildSentryOptions,
  shouldInitializeSentry,
} from "./observability/sentryConfig.ts";

const currentFileDir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(currentFileDir, "..", "..", ".env") });

if (shouldInitializeSentry(process.env)) {
  const require = createRequire(import.meta.url);
  const { version } = require("../package.json") as { version: string };

  Sentry.init(buildSentryOptions(process.env, version));
}

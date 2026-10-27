/**
 * Backend Sentry configuration: error monitoring only.
 *
 * Initialization is opt-in through `SENTRY_DSN` and stays off under Vitest or
 * `NODE_ENV=test`. There is no profiling or tracing. Every outgoing event loses
 * its request payload and is scrubbed by the shared telemetry helper.
 */
import type { ErrorEvent, NodeOptions } from "@sentry/node";
import { scrubTelemetry } from "restaurant-pos-packages/utils/sentryScrubbing";

export interface SentryEnvironment {
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  SENTRY_RELEASE?: string;
  NODE_ENV?: string;
  VITEST?: string;
}

const RELEASE_PREFIX = "restaurant-pos-backend@";

export function shouldInitializeSentry(env: SentryEnvironment): boolean {
  return (
    Boolean(env.SENTRY_DSN?.trim()) &&
    env.VITEST !== "true" &&
    env.NODE_ENV !== "test"
  );
}

function resolveEnvironment(env: SentryEnvironment): string {
  return (
    env.SENTRY_ENVIRONMENT?.trim() ||
    env.NODE_ENV?.trim() ||
    "development"
  );
}

function resolveRelease(
  env: SentryEnvironment,
  packageVersion: string,
): string {
  return env.SENTRY_RELEASE?.trim() || `${RELEASE_PREFIX}${packageVersion}`;
}

/**
 * Remove request data and reduce identity before an event leaves the process.
 * URL query values in extras, contexts, tags and breadcrumbs are stripped by
 * the shared scrubber.
 */
export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  const scrubbed: ErrorEvent = { ...event };

  delete scrubbed.request;

  if (scrubbed.user) {
    scrubbed.user =
      scrubbed.user.id === undefined ? undefined : { id: scrubbed.user.id };
  }
  if (scrubbed.extra) {
    scrubbed.extra = scrubTelemetry(scrubbed.extra);
  }
  if (scrubbed.contexts) {
    scrubbed.contexts = scrubTelemetry(scrubbed.contexts);
  }
  if (scrubbed.tags) {
    scrubbed.tags = scrubTelemetry(scrubbed.tags);
  }
  if (scrubbed.breadcrumbs) {
    scrubbed.breadcrumbs = scrubTelemetry(scrubbed.breadcrumbs);
  }

  return scrubbed;
}

export function buildSentryOptions(
  env: SentryEnvironment,
  packageVersion: string,
): NodeOptions {
  return {
    dsn: env.SENTRY_DSN?.trim(),
    environment: resolveEnvironment(env),
    release: resolveRelease(env, packageVersion),
    // PII off: no user info, cookies, headers, bodies, query values or local
    // variables. The reporter only attaches safe ids, and beforeSend scrubs
    // whatever remains.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
    },
    // The global problem-details handler is the only observer. Keep Sentry's
    // automatic Fastify error integration out so one failure is captured once.
    integrations: (integrations) =>
      integrations.filter((integration) => integration.name !== "Fastify"),
    beforeSend: (event) => scrubSentryEvent(event),
  };
}

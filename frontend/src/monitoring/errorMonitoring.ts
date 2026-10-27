/**
 * Frontend Sentry configuration: error monitoring only.
 *
 * Initialization is opt-in through `VITE_SENTRY_DSN` and stays off while Vite
 * is in `test` mode. There is no tracing, replay, profiling or feedback. Every
 * outgoing event loses request payloads, headers, cookies and identity beyond
 * a safe id, and is scrubbed by the shared telemetry helper.
 */
import * as Sentry from "@sentry/react";
import type { BrowserOptions, ErrorEvent } from "@sentry/react";
import {
  scrubTelemetry,
  scrubTelemetryUrl,
} from "restaurant-pos-packages/utils/sentryScrubbing";
import packageJson from "../../package.json";

export interface SentryEnvironment {
  VITE_SENTRY_DSN?: string;
  VITE_SENTRY_ENVIRONMENT?: string;
  VITE_SENTRY_RELEASE?: string;
  MODE?: string;
}

const RELEASE_PREFIX = "restaurant-pos-frontend@";

export function shouldInitializeSentry(env: SentryEnvironment): boolean {
  return Boolean(env.VITE_SENTRY_DSN?.trim()) && env.MODE !== "test";
}

function resolveEnvironment(env: SentryEnvironment): string {
  return (
    env.VITE_SENTRY_ENVIRONMENT?.trim() ||
    env.MODE?.trim() ||
    "development"
  );
}

function resolveRelease(
  env: SentryEnvironment,
  packageVersion: string,
): string {
  return env.VITE_SENTRY_RELEASE?.trim() || `${RELEASE_PREFIX}${packageVersion}`;
}

/**
 * Remove request bodies, headers, cookies and identity before an event leaves
 * the browser. The request URL stays useful without userinfo or query values,
 * and the shared scrubber handles extras, contexts, tags and breadcrumbs.
 */
export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  const scrubbed: ErrorEvent = { ...event };

  if (scrubbed.request) {
    const request = { ...scrubbed.request };
    delete request.data;
    delete request.headers;
    delete request.cookies;
    delete request.query_string;
    if (request.url) {
      request.url = scrubTelemetryUrl(request.url);
    }
    scrubbed.request = request;
  }

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
): BrowserOptions {
  return {
    dsn: env.VITE_SENTRY_DSN?.trim(),
    environment: resolveEnvironment(env),
    release: resolveRelease(env, packageVersion),
    // PII off: no user info, cookies, headers, bodies or query values. The
    // render reporter only attaches a component stack, and beforeSend scrubs
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
    beforeSend: (event) => scrubSentryEvent(event),
  };
}

export function initializeSentry(
  env: SentryEnvironment = import.meta.env,
  packageVersion: string = packageJson.version,
): void {
  if (!shouldInitializeSentry(env)) return;

  Sentry.init(buildSentryOptions(env, packageVersion));
}

/** One report per render crash caught by `ErrorBoundary`. */
export function reportRenderError(
  error: unknown,
  componentStack: string | null | undefined,
): void {
  if (!Sentry.getClient()) return;

  Sentry.captureException(error, {
    contexts: { react: { componentStack: componentStack ?? undefined } },
  });
}

/**
 * In-process counters for auth-email HTTP routes and token lifecycle (Phase 8.3).
 * Same scaling caveat as `communications/observability/metrics.ts` — not shared across instances.
 */

export type AuthEmailHttpRoute =
  | "request-email-confirmation"
  | "request-password-reset"
  | "confirm-email"
  | "reset-password"
  | "resend-email-confirmation";

export type AuthEmailConsumeIntentMetric = "email_confirmation" | "password_reset";

const requestsReceived: Record<string, number> = {};
const http2xx: Record<string, number> = {};
const http4xx: Record<string, number> = {};
const http5xx: Record<string, number> = {};
const http429: Record<string, number> = {};

let dispatchSuccesses = 0;
let dispatchFailures = 0;

const tokenConsumed: Record<string, number> = {};
const tokenRejected: Record<string, number> = {};
const tokenConsumeFailed: Record<string, number> = {};

function bump(bag: Record<string, number>, key: string, delta = 1): void {
  bag[key] = (bag[key] ?? 0) + delta;
}

/** One increment per HTTP handler invocation (after the route is matched). */
export function recordAuthEmailHttpRequestReceived(route: AuthEmailHttpRoute): void {
  bump(requestsReceived, route);
}

/** Classify terminal HTTP status for this auth-email route. */
export function recordAuthEmailHttpResponse(
  route: AuthEmailHttpRoute,
  statusCode: number,
): void {
  if (statusCode === 429) {
    bump(http429, route);
    return;
  }
  if (statusCode >= 200 && statusCode < 300) {
    bump(http2xx, route);
    return;
  }
  if (statusCode >= 500) {
    bump(http5xx, route);
    return;
  }
  if (statusCode >= 400) {
    bump(http4xx, route);
  }
}

export function recordAuthEmailDispatchSuccess(): void {
  dispatchSuccesses += 1;
}

export function recordAuthEmailDispatchFailure(): void {
  dispatchFailures += 1;
}

export function recordAuthEmailTokenConsumed(intent: AuthEmailConsumeIntentMetric): void {
  bump(tokenConsumed, intent);
}

export function recordAuthEmailTokenRejected(intent: AuthEmailConsumeIntentMetric): void {
  bump(tokenRejected, intent);
}

export function recordAuthEmailTokenConsumeFailed(intent: AuthEmailConsumeIntentMetric): void {
  bump(tokenConsumeFailed, intent);
}

/** For tests that assert metric deltas in isolation. */
export function __resetAuthEmailMetricsForTests(): void {
  for (const k of Object.keys(requestsReceived)) delete requestsReceived[k];
  for (const k of Object.keys(http2xx)) delete http2xx[k];
  for (const k of Object.keys(http4xx)) delete http4xx[k];
  for (const k of Object.keys(http5xx)) delete http5xx[k];
  for (const k of Object.keys(http429)) delete http429[k];
  dispatchSuccesses = 0;
  dispatchFailures = 0;
  for (const k of Object.keys(tokenConsumed)) delete tokenConsumed[k];
  for (const k of Object.keys(tokenRejected)) delete tokenRejected[k];
  for (const k of Object.keys(tokenConsumeFailed)) delete tokenConsumeFailed[k];
}

export function getAuthEmailMetricsSnapshot() {
  return {
    http: {
      requestsReceived: { ...requestsReceived },
      response2xx: { ...http2xx },
      response4xx: { ...http4xx },
      response5xx: { ...http5xx },
      response429: { ...http429 },
    },
    dispatch: {
      successes: dispatchSuccesses,
      failures: dispatchFailures,
    },
    tokenConsume: {
      consumed: { ...tokenConsumed },
      rejected: { ...tokenRejected },
      failed: { ...tokenConsumeFailed },
    },
  };
}

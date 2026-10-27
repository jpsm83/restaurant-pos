/**
 * Default failure reporter: one Sentry event per unexpected server failure.
 *
 * Request data never enters this context (see `failureReporting.ts`). The
 * user is reduced to an id, and only safe session identifiers travel as a
 * context. When the SDK is inert (no DSN or under test), capture is a no-op.
 */
import * as Sentry from "@sentry/node";

import type { FailureReporter } from "./failureReporting.ts";

export const sentryFailureReporter: FailureReporter = {
  report(error, context) {
    Sentry.withScope((scope) => {
      scope.setTag("http.method", context.method);
      scope.setTag("http.route", context.route);
      scope.setTag("http.status_code", String(context.status));

      if (context.session) {
        scope.setUser({ id: context.session.id });
        scope.setContext("session", {
          type: context.session.type,
          ...(context.session.employeeId
            ? { employeeId: context.session.employeeId }
            : {}),
          ...(context.session.businessId
            ? { businessId: context.session.businessId }
            : {}),
        });
      }

      Sentry.captureException(error);
    });
  },
};

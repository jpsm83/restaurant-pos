import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/node";
import { REDACTION_MARKER } from "restaurant-pos-packages/utils/sentryScrubbing";

import {
  buildSentryOptions,
  scrubSentryEvent,
  shouldInitializeSentry,
} from "../../src/observability/sentryConfig.ts";
import { sentryFailureReporter } from "../../src/errors/sentryFailureReporter.ts";

describe("Sentry backend initialization", () => {
  it("initializes only with a DSN outside tests", () => {
    expect(
      shouldInitializeSentry({
        SENTRY_DSN: "https://public@example.invalid/1",
        NODE_ENV: "production",
      }),
    ).toBe(true);
    expect(
      shouldInitializeSentry({
        SENTRY_DSN: "https://public@example.invalid/1",
        NODE_ENV: "test",
      }),
    ).toBe(false);
    expect(
      shouldInitializeSentry({
        SENTRY_DSN: "https://public@example.invalid/1",
        VITEST: "true",
      }),
    ).toBe(false);
    expect(shouldInitializeSentry({ NODE_ENV: "production" })).toBe(false);
    expect(
      shouldInitializeSentry({
        SENTRY_DSN: "   ",
        NODE_ENV: "production",
      }),
    ).toBe(false);
  });

  it("uses environment and release fallbacks with PII off and no tracing", () => {
    const explicit = buildSentryOptions(
      {
        SENTRY_DSN: "https://public@example.invalid/1",
        SENTRY_ENVIRONMENT: "staging",
        SENTRY_RELEASE: "git-sha",
        NODE_ENV: "production",
      },
      "2.3.4",
    );

    expect(explicit.dsn).toBe("https://public@example.invalid/1");
    expect(explicit.environment).toBe("staging");
    expect(explicit.release).toBe("git-sha");
    expect(explicit.dataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
    });

    const fallback = buildSentryOptions(
      {
        SENTRY_DSN: "https://public@example.invalid/1",
        NODE_ENV: "production",
      },
      "2.3.4",
    );

    expect(fallback.environment).toBe("production");
    expect(fallback.release).toBe("restaurant-pos-backend@2.3.4");

    const options = fallback as Record<string, unknown>;
    expect(options.tracesSampleRate).toBeUndefined();
    expect(options.tracesSampler).toBeUndefined();
    expect(options.profilesSampleRate).toBeUndefined();
    expect(options.profileSessionSampleRate).toBeUndefined();
  });

  it("leaves error capture to the problem-details handler, not Fastify's integration", () => {
    const options = buildSentryOptions(
      {
        SENTRY_DSN: "https://public@example.invalid/1",
        NODE_ENV: "production",
      },
      "2.3.4",
    );
    type NamedIntegration = { name: string };
    const applyIntegrations = options.integrations as (
      integrations: NamedIntegration[],
    ) => NamedIntegration[];

    const kept = applyIntegrations([{ name: "Fastify" }, { name: "LinkedErrors" }]);

    expect(kept.map((integration) => integration.name)).toEqual([
      "LinkedErrors",
    ]);
  });
});

describe("Sentry event scrubbing", () => {
  it("removes request data, reduces the user to an id, and scrubs telemetry extras", () => {
    const event = {
      request: {
        url: "https://user:pass@example.com/api/orders/42?token=secret",
        method: "POST",
        data: { password: "hunter2", email: "guest@example.com" },
        headers: { authorization: "Bearer header-secret" },
        cookies: { refresh: "cookie-secret" },
        query_string: "token=query-secret",
      },
      user: {
        id: "user-1",
        email: "guest@example.com",
        ip_address: "203.0.113.7",
        username: "guest",
      },
      extra: {
        token: "extra-secret",
        profile: {
          url: "/api/orders/42?token=query-secret",
          displayName: "Guest",
        },
      },
      contexts: {
        session: {
          authorization: "Bearer context-secret",
          region: "eu",
        },
      },
      tags: {
        token: "tag-secret",
        region: "eu",
      },
      breadcrumbs: [
        {
          category: "console",
          message: "boom",
          data: {
            password: "crumb-secret",
            url: "/api/orders/42?token=query-secret",
          },
        },
      ],
    } as unknown as ErrorEvent;

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.request).toBeUndefined();
    expect(scrubbed.user).toEqual({ id: "user-1" });
    expect(scrubbed.extra).toEqual({
      token: REDACTION_MARKER,
      profile: {
        url: "/api/orders/42",
        displayName: "Guest",
      },
    });
    expect(scrubbed.contexts).toEqual({
      session: {
        authorization: REDACTION_MARKER,
        region: "eu",
      },
    });
    expect(scrubbed.tags).toEqual({
      token: REDACTION_MARKER,
      region: "eu",
    });
    expect(scrubbed.breadcrumbs).toEqual([
      {
        category: "console",
        message: "boom",
        data: {
          password: REDACTION_MARKER,
          url: "/api/orders/42",
        },
      },
    ]);

    const serialized = JSON.stringify(scrubbed);
    for (const secret of [
      "header-secret",
      "cookie-secret",
      "query-secret",
      "extra-secret",
      "context-secret",
      "tag-secret",
      "crumb-secret",
      "hunter2",
      "203.0.113.7",
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("keeps capture harmless while the SDK is inert", () => {
    expect(() =>
      sentryFailureReporter.report(new Error("boom"), {
        method: "GET",
        route: "/boom",
        status: 500,
      }),
    ).not.toThrow();
  });
});

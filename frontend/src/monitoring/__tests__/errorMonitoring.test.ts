import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/react";
import type { ErrorEvent } from "@sentry/react";
import { REDACTION_MARKER } from "restaurant-pos-packages/utils/sentryScrubbing";

import {
  buildSentryOptions,
  initializeSentry,
  reportRenderError,
  scrubSentryEvent,
  shouldInitializeSentry,
} from "../errorMonitoring";

vi.mock("@sentry/react", () => ({
  captureException: vi.fn(),
  getClient: vi.fn(),
  init: vi.fn(),
}));

const DSN = "https://public@example.invalid/1";

describe("Sentry frontend initialization", () => {
  beforeEach(() => {
    vi.mocked(Sentry.init).mockClear();
    vi.mocked(Sentry.captureException).mockClear();
    vi.mocked(Sentry.getClient).mockReset();
  });

  it("initializes only with a DSN outside Vite test mode", () => {
    expect(
      shouldInitializeSentry({ VITE_SENTRY_DSN: DSN, MODE: "production" }),
    ).toBe(true);
    expect(
      shouldInitializeSentry({ VITE_SENTRY_DSN: DSN, MODE: "test" }),
    ).toBe(false);
    expect(shouldInitializeSentry({ MODE: "production" })).toBe(false);
    expect(
      shouldInitializeSentry({ VITE_SENTRY_DSN: "   ", MODE: "production" }),
    ).toBe(false);
  });

  it("does not initialize under Vitest boot", () => {
    expect(import.meta.env.MODE).toBe("test");

    initializeSentry();

    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it("does not initialize without a DSN", () => {
    initializeSentry({ MODE: "production" });

    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it("initializes once with the resolved options", () => {
    initializeSentry({ VITE_SENTRY_DSN: DSN, MODE: "production" }, "2.3.4");

    expect(Sentry.init).toHaveBeenCalledTimes(1);
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: DSN,
        environment: "production",
        release: "restaurant-pos-frontend@2.3.4",
      }),
    );
  });

  it("uses environment, release and mode fallbacks with PII off and no tracing", () => {
    const explicit = buildSentryOptions(
      {
        VITE_SENTRY_DSN: DSN,
        VITE_SENTRY_ENVIRONMENT: "staging",
        VITE_SENTRY_RELEASE: "git-sha",
        MODE: "production",
      },
      "2.3.4",
    );

    expect(explicit.dsn).toBe(DSN);
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
      { VITE_SENTRY_DSN: DSN, MODE: "production" },
      "2.3.4",
    );

    expect(fallback.environment).toBe("production");
    expect(fallback.release).toBe("restaurant-pos-frontend@2.3.4");

    const options = fallback as Record<string, unknown>;
    expect(options.integrations).toBeUndefined();
    expect(options.tracesSampleRate).toBeUndefined();
    expect(options.tracesSampler).toBeUndefined();
    expect(options.profilesSampleRate).toBeUndefined();
    expect(options.profileSessionSampleRate).toBeUndefined();
    expect(options.replaysSessionSampleRate).toBeUndefined();
    expect(options.replaysOnErrorSampleRate).toBeUndefined();
  });

  it("scrubs request data, identity and telemetry before send", () => {
    const options = buildSentryOptions(
      { VITE_SENTRY_DSN: DSN, MODE: "production" },
      "2.3.4",
    );
    const beforeSend = options.beforeSend as (
      event: ErrorEvent,
    ) => ErrorEvent | null;
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
        react: { componentStack: "at ThrowingChild" },
        session: { authorization: "Bearer context-secret", region: "eu" },
      },
      tags: { token: "tag-secret", region: "eu" },
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

    const scrubbed = beforeSend(event);

    expect(scrubbed?.request).toEqual({
      url: "https://example.com/api/orders/42",
      method: "POST",
    });
    expect(scrubbed?.user).toEqual({ id: "user-1" });
    expect(scrubbed?.extra).toEqual({
      token: REDACTION_MARKER,
      profile: {
        url: "/api/orders/42",
        displayName: "Guest",
      },
    });
    expect(scrubbed?.contexts).toEqual({
      react: { componentStack: "at ThrowingChild" },
      session: { authorization: REDACTION_MARKER, region: "eu" },
    });
    expect(scrubbed?.tags).toEqual({ token: REDACTION_MARKER, region: "eu" });
    expect(scrubbed?.breadcrumbs).toEqual([
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
      "guest@example.com",
      "203.0.113.7",
      "user:pass",
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("drops a user without a safe id", () => {
    const scrubbed = scrubSentryEvent({
      user: { email: "guest@example.com", ip_address: "203.0.113.7" },
    } as unknown as ErrorEvent);

    expect(scrubbed.user).toBeUndefined();
  });

  it("reports a render error with its component stack", () => {
    vi.mocked(Sentry.getClient).mockReturnValue({} as never);
    const error = new Error("boom");

    reportRenderError(error, "at ThrowingChild");

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      contexts: { react: { componentStack: "at ThrowingChild" } },
    });
  });

  it("does not capture while the SDK is inert", () => {
    vi.mocked(Sentry.getClient).mockReturnValue(undefined);

    reportRenderError(new Error("boom"), "at ThrowingChild");

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});

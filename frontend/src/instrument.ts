/**
 * Loaded before the rest of the app from `main.tsx`.
 * Errors, tracing, session replay, and user feedback.
 */
import { useEffect } from "react";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;
const isProduction = import.meta.env.PROD;
const apiBase = import.meta.env.VITE_API_BASE_URL?.trim();

const tracePropagationTargets: Array<string | RegExp> = [
  /^\//,
  /^https?:\/\/localhost(?::\d+)?/,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?/,
];

if (apiBase) {
  tracePropagationTargets.push(apiBase);
}

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE || "restaurant-pos-frontend@0.0.0",
    integrations: [
      Sentry.reactRouterV7BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      Sentry.replayIntegration(),
      Sentry.feedbackIntegration({
        colorScheme: "system",
      }),
    ],
    // Full rate locally so a verification session is kept. 10% in production.
    tracesSampleRate: isProduction ? 0.1 : 1,
    tracePropagationTargets,
    replaysSessionSampleRate: isProduction ? 0.1 : 1,
    replaysOnErrorSampleRate: 1,
  });
}

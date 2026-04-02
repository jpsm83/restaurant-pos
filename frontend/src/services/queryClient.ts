/**
 * App-wide TanStack Query client — provided in **`main.tsx`** wrapping the tree **outside**
 * `AuthProvider` so cached data survives session changes while `http` still picks up the latest
 * Bearer token from `auth/api` on each request.
 *
 * **`auth/api.ts`** imports this singleton to invalidate queries after login / refresh / logout.
 * Hooks in `authMode.ts` use `useQueryClient()` from context for mode-specific invalidation.
 *
 * ## Busy-time baseline policy (Phase 2.1)
 * - Keep data fresh enough for dashboard UX without aggressive refetch storms.
 * - Retry only transient failures (network / 408 / 429 / 5xx), never generic 4xx.
 * - Avoid automatic refetch-on-focus spikes across many open tabs/operators.
 * - Keep error behavior explicit in screen-level code (no global throw-to-boundary default).
 */
import { QueryClient } from "@tanstack/react-query";

const DEFAULT_STALE_TIME_MS = 60_000;
const DEFAULT_GC_TIME_MS = 10 * 60_000;
const MAX_QUERY_RETRIES = 2;
const MAX_MUTATION_RETRIES = 1;

function getHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;

  const response = (error as { response?: { status?: unknown } }).response;
  const status = response?.status;
  return typeof status === "number" ? status : undefined;
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function shouldRetryByStatus(
  failureCount: number,
  error: unknown,
  maxRetries: number,
): boolean {
  if (failureCount >= maxRetries) return false;

  const status = getHttpStatus(error);
  // No status usually means a transport/network error.
  if (status === undefined) return true;

  return isTransientStatus(status);
}

function retryDelay(attemptIndex: number): number {
  const base = 500;
  const max = 5_000;
  return Math.min(base * 2 ** attemptIndex, max);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: DEFAULT_STALE_TIME_MS,
      gcTime: DEFAULT_GC_TIME_MS,
      retry: (failureCount, error) =>
        shouldRetryByStatus(failureCount, error, MAX_QUERY_RETRIES),
      retryDelay,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      throwOnError: false,
    },
    mutations: {
      retry: (failureCount, error) =>
        shouldRetryByStatus(failureCount, error, MAX_MUTATION_RETRIES),
      retryDelay,
      throwOnError: false,
    },
  },
});

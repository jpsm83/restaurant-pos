/**
 * App-wide TanStack Query client — provided in **`main.tsx`** wrapping the tree **outside**
 * `AuthProvider` so cached data survives session changes while `http` still picks up the latest
 * Bearer token from `auth/api` on each request.
 *
 * **`auth/api.ts`** imports this singleton to invalidate queries after login / refresh / logout.
 * Hooks in `authMode.ts` use `useQueryClient()` from context for mode-specific invalidation.
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 2,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

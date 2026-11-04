/**
 * **`src/context`** — shared UI/session context layer.
 *
 * ## `AuthModeContext` (this file)
 * Bridges **`services/authMode.ts`** (TanStack Query + `http`) into a single **`useAuthMode()`** hook
 * for the rest of the app. Exposes session-backed **`customer` | `business`** mode, loading/error,
 * **`setModeAndRefresh`**, and **`refreshMode`**.
 *
 * ## Wiring
 * 1. **`AuthModeProvider`** is mounted in **`App.tsx`** inside **`BrowserRouter`** (needs **`useLocation`**).
 * 2. **`useAuthModeQuery`** is **enabled** only when:
 *    - session is authenticated **`type === "user"`**, and
 *    - pathname is mode-scoped (`isModeScopedPath` in `routes/canonicalPaths.ts`) — a Customer,
 *      account, mode, or venue route.
 *    Else the query is off and `mode` is `undefined` (no spurious `/auth/mode` calls on marketing/tenant).
 * 3. **`useSetAuthModeMutation`** runs **`POST /auth/set-mode`**; the cross-tab signal and the
 *    awaited invalidation/refetch of **`auth.mode`** are handled in **`authMode.ts`**. Callers that
 *    navigate afterwards can rely on the new stored mode being read before they move.
 * 4. A same-origin tab that receives the signal invalidates its **`auth.mode`** query, so both tabs refetch the server-stored mode.
 * 5. **Consumers:** **`SelectUserModePage`** switches through **`useAuthModeNavigation`**;
 *    the route guards call **`setModeAndRefresh`** to switch or reconcile. Import directly from
 *    **`@/context/AuthModeContext`** (barrel files are deprecated).
 *
 * Depends on: **`useAuth`** (`AuthContext`), **`useAuthModeQuery` / `useSetAuthModeMutation`** (`authMode.ts`).
 */
/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/auth/store/AuthContext";
import {
  type AuthMode,
  useAuthModeQuery,
  useSetAuthModeMutation,
} from "@/services/authMode";
import { subscribeToAuthModeChanges } from "@/services/authModeSync";
import { queryKeys } from "@/services/queryKeys";
import { isModeScopedPath } from "@/routes/canonicalPaths";

export type { AuthMode };

type AuthModeContextValue = {
  /** Server-stored mode from `GET /auth/mode` while on a user shell route; `undefined` if not applicable or still loading. */
  mode: AuthMode | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  /** Refetch `GET /auth/mode` (no-op when query disabled). */
  refreshMode: () => Promise<unknown>;
  /** `POST /api/v1/auth/set-mode`; mutation invalidates mode query (see `services/authMode.ts`). */
  setModeAndRefresh: (mode: AuthMode) => Promise<void>;
};

const AuthModeContext = createContext<AuthModeContextValue | undefined>(
  undefined,
);

export function AuthModeProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { state } = useAuth();
  const queryClient = useQueryClient();

  const isUserSession =
    state.status === "authenticated" && state.user?.type === "user";

  const queryEnabled = isUserSession && isModeScopedPath(pathname);

  const { data, isLoading, isError, error, refetch } = useAuthModeQuery({
    enabled: queryEnabled,
  });

  const setModeMutation = useSetAuthModeMutation();

  useEffect(
    () =>
      subscribeToAuthModeChanges(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.auth.mode() });
      }),
    [queryClient],
  );

  const refreshMode = useCallback(async () => {
    if (!queryEnabled) return;
    return refetch();
  }, [queryEnabled, refetch]);

  const setModeAndRefresh = useCallback(
    async (mode: AuthMode) => {
      if (!isUserSession) return;
      // The mutation's `onSuccess` awaits the invalidated mode read, so the
      // session reports the new mode by the time this resolves.
      await setModeMutation.mutateAsync(mode);
    },
    [isUserSession, setModeMutation],
  );

  const value = useMemo<AuthModeContextValue>(
    () => ({
      mode: queryEnabled ? data : undefined,
      isLoading: queryEnabled && isLoading,
      isError: queryEnabled && isError,
      error:
        queryEnabled && isError && error instanceof Error ? error : null,
      refreshMode,
      setModeAndRefresh,
    }),
    [
      queryEnabled,
      data,
      isLoading,
      isError,
      error,
      refreshMode,
      setModeAndRefresh,
    ],
  );

  return (
    <AuthModeContext.Provider value={value}>{children}</AuthModeContext.Provider>
  );
}

export function useAuthMode(): AuthModeContextValue {
  const ctx = useContext(AuthModeContext);
  if (!ctx) {
    throw new Error("useAuthMode must be used within AuthModeProvider");
  }
  return ctx;
}

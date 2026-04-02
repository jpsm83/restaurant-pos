/**
 * **`src/context`** — shared UI/session context layer.
 *
 * ## `AuthModeContext` (this file)
 * Bridges **`services/authMode.ts`** (TanStack Query + `http`) into a single **`useAuthMode()`** hook
 * for the rest of the app. Exposes cookie-backed **`customer` | `employee`** mode, loading/error,
 * **`setModeAndRefresh`**, and **`refreshMode`**.
 *
 * ## Wiring
 * 1. **`AuthModeProvider`** is mounted in **`App.tsx`** inside **`BrowserRouter`** (needs **`useLocation`**).
 * 2. **`useAuthModeQuery`** is **enabled** only when:
 *    - session is authenticated **`type === "user"`**, and
 *    - pathname matches **`/:userId/(customer|mode|employee)`** (`isUserShellPath`).
 *    Else the query is off and `mode` is `undefined` (no spurious `/auth/mode` calls on marketing/tenant).
 * 3. **`useSetAuthModeMutation`** runs **`POST /auth/set-mode`**; invalidation is handled in **`authMode.ts`**.
 * 4. **Consumers:** **`RequireEmployeeAuthMode`** (`routes/AuthRouteGuards.tsx`) gates employee routes;
 *    **`SelectUserModePage`** calls **`setModeAndRefresh`** then navigates. Import directly from
 *    **`@/context/AuthModeContext`** (barrel files are deprecated).
 *
 * Depends on: **`useAuth`** (`AuthContext`), **`useAuthModeQuery` / `useSetAuthModeMutation`** (`authMode.ts`).
 */
/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/auth/store/AuthContext";
import {
  type AuthMode,
  useAuthModeQuery,
  useSetAuthModeMutation,
} from "@/services/authMode";

export type { AuthMode };

type AuthModeContextValue = {
  /** Cookie-backed mode from `GET /auth/mode` while on a user shell route; `undefined` if not applicable or still loading. */
  mode: AuthMode | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  /** True while `POST /auth/set-mode` is in flight (e.g. mode selection page). */
  isSettingMode: boolean;
  /** Refetch `GET /auth/mode` (no-op when query disabled). */
  refreshMode: () => Promise<unknown>;
  /** `POST /api/v1/auth/set-mode`; mutation invalidates mode query (see `services/authMode.ts`). */
  setModeAndRefresh: (mode: AuthMode) => Promise<void>;
};

const AuthModeContext = createContext<AuthModeContextValue | undefined>(
  undefined,
);

/** `/:userId/customer|mode|employee` — not marketing, not tenant shell. */
function isUserShellPath(pathname: string): boolean {
  return /^\/[^/]+\/(customer|mode|employee)(\/|$)/.test(pathname);
}

export function AuthModeProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { state } = useAuth();

  const isUserSession =
    state.status === "authenticated" && state.user?.type === "user";

  const queryEnabled = isUserSession && isUserShellPath(pathname);

  const { data, isLoading, isError, error, refetch } = useAuthModeQuery({
    enabled: queryEnabled,
  });

  const setModeMutation = useSetAuthModeMutation();

  const refreshMode = useCallback(async () => {
    if (!queryEnabled) return;
    return refetch();
  }, [queryEnabled, refetch]);

  const setModeAndRefresh = useCallback(
    async (mode: AuthMode) => {
      if (!isUserSession) return;
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
      isSettingMode: setModeMutation.isPending,
      refreshMode,
      setModeAndRefresh,
    }),
    [
      queryEnabled,
      data,
      isLoading,
      isError,
      error,
      setModeMutation.isPending,
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

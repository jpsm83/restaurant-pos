/* Context + hook — same module (react-refresh exception). */
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
  /** `POST /auth/mode` then refresh cache via mutation `invalidateQueries`. */
  setModeAndRefresh: (mode: AuthMode) => Promise<void>;
};

const AuthModeContext = createContext<AuthModeContextValue | undefined>(
  undefined,
);

/** `/:userId/customer|mode|employee` — not marketing, not tenant shell. */
function isUserShellPath(pathname: string): boolean {
  return /^\/[^/]+\/(customer|mode|employee)(\/|$)/.test(pathname);
}

/**
 * Fetches **`auth_mode`** only for **`type === "user"`** sessions on user-shell URLs (Phase 3.2.2).
 * Mount under **`BrowserRouter`** (uses **`useLocation`**).
 */
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

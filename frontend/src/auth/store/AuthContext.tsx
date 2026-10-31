/**
 * **React session store** for **`src/auth`** — `AuthProvider` + **`useAuth()`** (`state` + `dispatch`).
 *
 * ## Wiring
 * - Mounted in **`main.tsx`** inside **`QueryClientProvider`** and **`ErrorBoundary`** (order documented there).
 * - **Bootstrap (once on mount):** load persisted access token → `GET /me`; otherwise `POST /refresh` only when a prior session exists, then `GET /me`; set `auth_had_session` / expired notice flags as in code.
 * - **Cross-tab session signals (once on mount):** sign-out clears the token, hint, auth state, and cached queries; sign-in discards the stale token, refreshes, re-reads the User, and adopts the browser's current identity.
 * - **Live connection:** follows the access session via `setAccessToken` in `api.ts` (open on sign-in, close on sign-out).
 * - **Consumers:** route guards, `Navbar`, login/signup pages, `AccountMenuPopover`, `SelectUserModePage`, `AuthModeContext` (reads session to enable mode query), etc.
 *
 * ## Actions
 * `AUTH_LOADING` | `AUTH_SUCCESS` | `AUTH_CLEAR` | `AUTH_ERROR` — pages call **`login`/`signup`** from **`api.ts`**, then dispatch success with the returned `user` payload.
 *
 * This is **JWT identity**; the workspace mode lives on the refresh session — see **`AuthModeProvider`** (`@/auth` re-export from `context`).
 */
/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useEffect,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getCurrentUser,
  loadPersistedAccessToken,
  refreshSession,
  setAccessToken,
} from "../api";
import type { AuthSession, AuthState } from "../types";
import {
  clearPriorSession,
  hasPriorSession,
  markPriorSession,
} from "../sessionHint";
import { subscribeToAuthSessionChanges } from "../sessionSync";
import type { ServiceErrorCode } from "@/services/serviceErrors";
import { isSupportedLanguage } from "@/i18n/config";
import { changeAppLanguage } from "@/i18n/i18n";

type AuthAction =
  | { type: "AUTH_LOADING" }
  | { type: "AUTH_SUCCESS"; payload: AuthSession }
  | { type: "AUTH_CLEAR" }
  | { type: "AUTH_ERROR"; payload: ServiceErrorCode | null };

const initialState: AuthState = {
  user: null,
  status: "idle",
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "AUTH_LOADING":
      return { ...state, status: "loading", error: null };
    case "AUTH_SUCCESS":
      return {
        ...state,
        user: action.payload,
        status: "authenticated",
        error: null,
      };
    case "AUTH_CLEAR":
      return {
        ...state,
        user: null,
        status: "unauthenticated",
        error: null,
      };
    case "AUTH_ERROR":
      return {
        ...state,
        user: null,
        status: "unauthenticated",
        error: action.payload,
      };
    default:
      return state;
  }
}

interface AuthContextValue {
  state: AuthState;
  dispatch: Dispatch<AuthAction>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const queryClient = useQueryClient();

  const hydratedLanguage =
    state.status === "authenticated"
      ? state.user?.languagePreference
      : undefined;

  useEffect(() => {
    if (hydratedLanguage && isSupportedLanguage(hydratedLanguage)) {
      void changeAppLanguage(hydratedLanguage);
    }
  }, [hydratedLanguage]);

  useEffect(() => {
    const bootstrapAuth = async () => {
      dispatch({ type: "AUTH_LOADING" });

      const persisted = loadPersistedAccessToken();
      if (persisted) {
        setAccessToken(persisted);
        const meFromStorage = await getCurrentUser();
        if (meFromStorage.ok && meFromStorage.data) {
          markPriorSession();
          dispatch({ type: "AUTH_SUCCESS", payload: meFromStorage.data });
          return;
        }
        setAccessToken(null);
      }

      const hadSession = hasPriorSession();
      if (!persisted && !hadSession) {
        // No token and no prior session: do not ask the API for a refresh.
        // An anonymous visitor has no cookie, so the call could only 401.
        dispatch({ type: "AUTH_CLEAR" });
        return;
      }

      const refreshResult = await refreshSession();
      if (!refreshResult.ok || !refreshResult.data?.accessToken) {
        setAccessToken(null);
        // Only an authentication failure ends the prior session. A transport
        // or server failure keeps the hint so the next load can retry.
        if (
          hadSession &&
          !refreshResult.ok &&
          refreshResult.error.code.endsWith(".unauthorized")
        ) {
          sessionStorage.setItem("auth_session_expired_notice", "1");
          clearPriorSession();
        }
        dispatch({ type: "AUTH_CLEAR" });
        return;
      }

      setAccessToken(refreshResult.data.accessToken);

      const meResult = await getCurrentUser();
      if (!meResult.ok || !meResult.data) {
        setAccessToken(null);
        if (meResult.ok || meResult.error.code.endsWith(".unauthorized")) {
          clearPriorSession();
        }
        dispatch({
          type: "AUTH_ERROR",
          payload: meResult.ok
            ? "session.internal"
            : meResult.error.code,
        });
        return;
      }

      markPriorSession();
      dispatch({ type: "AUTH_SUCCESS", payload: meResult.data });
    };

    void bootstrapAuth();
  }, []);

  useEffect(() => {
    const clearLocalSession = () => {
      setAccessToken(null);
      clearPriorSession();
      queryClient.clear();
      dispatch({ type: "AUTH_CLEAR" });
    };

    const restoreSignedInUser = async () => {
      clearLocalSession();

      const refreshResult = await refreshSession();
      if (!refreshResult.ok || !refreshResult.data?.accessToken) {
        clearLocalSession();
        return;
      }

      setAccessToken(refreshResult.data.accessToken);

      const meResult = await getCurrentUser();
      if (!meResult.ok || !meResult.data) {
        clearLocalSession();
        return;
      }

      markPriorSession();
      dispatch({ type: "AUTH_SUCCESS", payload: meResult.data });
    };

    return subscribeToAuthSessionChanges((signal) => {
      if (signal === "sign-out") {
        clearLocalSession();
        return;
      }

      void restoreSignedInUser();
    });
  }, [queryClient]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}

/**
 * **React session store** for **`src/auth`** — `AuthProvider` + **`useAuth()`** (`state` + `dispatch`).
 *
 * ## Wiring
 * - Mounted in **`main.tsx`** inside **`QueryClientProvider`** and **`ErrorBoundary`** (order documented there).
 * - **Bootstrap (once on mount):** load persisted access token → `GET /me`; else `POST /refresh` then `GET /me`; set `auth_had_session` / expired notice flags as in code.
 * - **Consumers:** route guards, `Navbar`, login/signup pages, `AccountMenuPopover`, `SelectUserModePage`, `AuthModeContext` (reads session to enable mode query), etc.
 *
 * ## Actions
 * `AUTH_LOADING` | `AUTH_SUCCESS` | `AUTH_CLEAR` | `AUTH_ERROR` — pages call **`login`/`signup`** from **`api.ts`**, then dispatch success with the returned `user` payload.
 *
 * This is **JWT identity**, not **`auth_mode`** cookie — see **`AuthModeProvider`** (`@/auth` re-export from `context`).
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
import {
  getCurrentUser,
  loadPersistedAccessToken,
  refreshSession,
  setAccessToken,
} from "../api";
import type { AuthSession, AuthState } from "../types";

type AuthAction =
  | { type: "AUTH_LOADING" }
  | { type: "AUTH_SUCCESS"; payload: AuthSession }
  | { type: "AUTH_CLEAR" }
  | { type: "AUTH_ERROR"; payload: string | null };

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

  useEffect(() => {
    const bootstrapAuth = async () => {
      dispatch({ type: "AUTH_LOADING" });

      const persisted = loadPersistedAccessToken();
      if (persisted) {
        setAccessToken(persisted);
        const meFromStorage = await getCurrentUser();
        if (meFromStorage.ok && meFromStorage.data) {
          localStorage.setItem("auth_had_session", "1");
          dispatch({ type: "AUTH_SUCCESS", payload: meFromStorage.data });
          return;
        }
        setAccessToken(null);
      }

      const refreshResult = await refreshSession();
      if (!refreshResult.ok || !refreshResult.data?.accessToken) {
        const hadSession = localStorage.getItem("auth_had_session") === "1";
        setAccessToken(null);
        if (hadSession) {
          sessionStorage.setItem("auth_session_expired_notice", "1");
          localStorage.removeItem("auth_had_session");
        }
        dispatch({ type: "AUTH_CLEAR" });
        return;
      }

      setAccessToken(refreshResult.data.accessToken);

      const meResult = await getCurrentUser();
      if (!meResult.ok || !meResult.data) {
        setAccessToken(null);
        localStorage.removeItem("auth_had_session");
        dispatch({
          type: "AUTH_ERROR",
          payload: meResult.ok ? "Session restore failed" : meResult.error,
        });
        return;
      }

      localStorage.setItem("auth_had_session", "1");
      dispatch({ type: "AUTH_SUCCESS", payload: meResult.data });
    };

    void bootstrapAuth();
  }, []);

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

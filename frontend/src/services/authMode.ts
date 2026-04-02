/**
 * Auth **workspace mode** API (`customer` vs `employee`) — HttpOnly cookie via backend.
 *
 * ## Flow
 * 1. **`getAuthMode` / `useAuthModeQuery`** — `GET /api/v1/auth/mode` through shared `http`.
 * 2. **`setAuthMode` / `useSetAuthModeMutation`** — `POST /api/v1/auth/set-mode`; on success
 *    invalidates `queryKeys.auth.mode()`.
 * 3. **`AuthModeContext`** (`context/AuthModeContext.tsx`) composes these hooks for the app shell;
 *    **`RequireEmployeeAuthMode`** (`routes/AuthRouteGuards.tsx`) gates `/:userId/employee/*` on
 *    the resolved mode.
 *
 * Depends on: `./http`, `./queryKeys`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  IAuthMode,
  IAuthModeResponse,
  ISetAuthModeBody,
} from "@packages/interfaces/IAuth.ts";
import { http } from "./http";
import { queryKeys } from "./queryKeys";
import { toServiceRequestError } from "./serviceErrors";

export type AuthMode = IAuthMode;

/** UI fallback when `POST /auth/set-mode` returns 403 without a body message (Phase 3.1.3). */
export const EMPLOYEE_MODE_NOT_ALLOWED_MESSAGE = "Employee mode not allowed";

/** `GET /api/v1/auth/mode` — reads `auth_mode` cookie (defaults to `customer`). */
export async function getAuthMode(signal?: AbortSignal): Promise<AuthMode> {
  try {
    const { data } = await http.get<IAuthModeResponse>("/api/v1/auth/mode", {
      signal,
    });
    return data.mode === "employee" ? "employee" : "customer";
  } catch (e) {
    throw toServiceRequestError(e, {
      fallback: "Failed to fetch auth mode",
      byStatus: {
        401: "Please sign in to access workspace mode.",
        403: "You do not have permission to access workspace mode.",
      },
    });
  }
}

/**
 * `POST /api/v1/auth/set-mode` — sets HttpOnly `auth_mode` cookie (Bearer required).
 * @throws Error with server `message` or {@link EMPLOYEE_MODE_NOT_ALLOWED_MESSAGE} on 403.
 */
export async function setAuthMode(mode: AuthMode): Promise<void> {
  try {
    const body: ISetAuthModeBody = { mode };
    await http.post("/api/v1/auth/set-mode", body);
  } catch (e) {
    const mapped = toServiceRequestError(e, {
      fallback: "Failed to set auth mode",
      byStatus: {
        401: "Please sign in to set workspace mode.",
        403: EMPLOYEE_MODE_NOT_ALLOWED_MESSAGE,
      },
    });
    throw new Error(mapped.message);
  }
}

export function useAuthModeQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.auth.mode(),
    queryFn: ({ signal }) => getAuthMode(signal),
    enabled: options?.enabled ?? true,
  });
}

export function useSetAuthModeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setAuthMode,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.mode() });
    },
  });
}

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
} from "restaurant-pos-packages/interfaces/IAuth";
import { http } from "./http";
import { queryKeys } from "./queryKeys";
import { toServiceRequestError } from "./serviceErrors";

export type AuthMode = IAuthMode;

/** `GET /api/v1/auth/mode` — reads `auth_mode` cookie (defaults to `customer`). */
export async function getAuthMode(signal?: AbortSignal): Promise<AuthMode> {
  try {
    const { data } = await http.get<IAuthModeResponse>("/api/v1/auth/mode", {
      signal,
    });
    return data.mode === "employee" ? "employee" : "customer";
  } catch (e) {
    throw toServiceRequestError(e, "modeLoad");
  }
}

/**
 * `POST /api/v1/auth/set-mode` — sets HttpOnly `auth_mode` cookie (Bearer required).
 * @throws ServiceRequestError with a `modeSave.*` code.
 */
export async function setAuthMode(mode: AuthMode): Promise<void> {
  try {
    const body: ISetAuthModeBody = { mode };
    await http.post("/api/v1/auth/set-mode", body);
  } catch (e) {
    throw toServiceRequestError(e, "modeSave");
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

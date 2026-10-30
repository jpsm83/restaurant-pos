/**
 * Auth **workspace mode** API (`customer` vs `business`) — stored on the refresh session by the backend.
 *
 * ## Flow
 * 1. **`getAuthMode` / `useAuthModeQuery`** — `GET /api/v1/auth/mode` through shared `http`.
 * 2. **`setAuthMode` / `useSetAuthModeMutation`** — `POST /api/v1/auth/set-mode`; on success
 *    invalidates `queryKeys.auth.mode()` and signals other tabs through `authModeSync`.
 * 3. **`AuthModeContext`** (`context/AuthModeContext.tsx`) composes these hooks for the app shell,
 *    invalidating its mode query when another tab changes the stored mode;
 *    **`RequireEmployeeAuthMode`** (`routes/AuthRouteGuards.tsx`) gates `/employee/*` on
 *    the resolved mode.
 *
 * Depends on: `./authModeSync`, `./http`, `./queryKeys`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  IAuthMode,
  IAuthModeResponse,
  ISetAuthModeBody,
} from "restaurant-pos-packages/interfaces/IAuth";
import { publishAuthModeChange } from "./authModeSync";
import { http } from "./http";
import { queryKeys } from "./queryKeys";
import { toServiceRequestError } from "./serviceErrors";

export type AuthMode = IAuthMode;

/** `GET /api/v1/auth/mode` — reads the access session's stored mode (defaults to `customer`). */
export async function getAuthMode(signal?: AbortSignal): Promise<AuthMode> {
  try {
    const { data } = await http.get<IAuthModeResponse>("/api/v1/auth/mode", {
      signal,
    });
    return data.mode === "business" ? "business" : "customer";
  } catch (e) {
    throw toServiceRequestError(e, "modeLoad");
  }
}

/**
 * `POST /api/v1/auth/set-mode` — updates the refresh session mode (Bearer required).
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
      publishAuthModeChange();
    },
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios, { type AxiosError } from "axios";
import { http } from "./http";
import { queryKeys } from "./queryKeys";

export type AuthMode = "customer" | "employee";

/** UI fallback when `POST /auth/set-mode` returns 403 without a body message (Phase 3.1.3). */
export const EMPLOYEE_MODE_NOT_ALLOWED_MESSAGE = "Employee mode not allowed";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function messageFromAxiosError(error: AxiosError): string {
  const data = error.response?.data;
  if (isRecord(data) && typeof data.message === "string") {
    return data.message;
  }
  return error.message;
}

/** `GET /api/v1/auth/mode` — reads `auth_mode` cookie (defaults to `customer`). */
export async function getAuthMode(): Promise<AuthMode> {
  const { data } = await http.get<{ mode?: string }>("/api/v1/auth/mode");
  return data.mode === "employee" ? "employee" : "customer";
}

/**
 * `POST /api/v1/auth/set-mode` — sets HttpOnly `auth_mode` cookie (Bearer required).
 * @throws Error with server `message` or {@link EMPLOYEE_MODE_NOT_ALLOWED_MESSAGE} on 403.
 */
export async function setAuthMode(mode: AuthMode): Promise<void> {
  try {
    await http.post("/api/v1/auth/set-mode", { mode });
  } catch (e) {
    if (axios.isAxiosError(e)) {
      const status = e.response?.status;
      const msg = messageFromAxiosError(e);
      if (status === 403) {
        throw new Error(msg.trim() || EMPLOYEE_MODE_NOT_ALLOWED_MESSAGE);
      }
      throw new Error(msg.trim() || "Failed to set auth mode");
    }
    throw e;
  }
}

export function useAuthModeQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.auth.mode(),
    queryFn: getAuthMode,
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

/**
 * Business **registration** API — multipart `POST /api/v1/business`.
 *
 * ## Flow
 * 1. **`createBusiness`** — posts `FormData` via shared `http` with Content-Type stripped so Axios
 *    sets multipart boundary; on success calls **`setAccessToken`** from `auth/api` when the API
 *    returns a token.
 * 2. **`useCreateBusinessMutation`** — wraps `createBusiness` for **`BusinessRegisterPage`**.
 *
 * Depends on: `./http`, `@/auth/api` (token side effect only).
 */
import { useMutation } from "@tanstack/react-query";
import axios, { AxiosHeaders, type AxiosRequestConfig } from "axios";
import { setAccessToken } from "@/auth/api";
import type { AuthBusiness, AuthSession } from "@/auth/types";
import { http } from "./http";

/**
 * Successful **`POST /api/v1/business`** body (multipart registration).
 * Mirrors `backend/src/routes/v1/business.ts` success payload.
 */
export type CreateBusinessResponseBody = {
  message?: string;
  accessToken?: string;
  user?: AuthSession;
};

/** Result after applying session from a successful registration (Phase 4.1.2). */
export type CreateBusinessSuccess = {
  message?: string;
  accessToken?: string;
  user: AuthBusiness;
};

/**
 * Axios instance defaults set **`Content-Type: application/json`**, which breaks **`FormData`**
 * (boundary must be set by the runtime). Strip it for this request only.
 */
const multipartFormDataConfig: AxiosRequestConfig = {
  transformRequest: [
    (data, headers) => {
      if (headers instanceof AxiosHeaders) {
        headers.delete("Content-Type");
      } else if (headers && typeof headers === "object") {
        delete (headers as Record<string, unknown>)["Content-Type"];
      }
      return data;
    },
  ],
};

/**
 * Multipart **`POST /api/v1/business`** (`withCredentials` via shared **`http`**).
 * On success: **`setAccessToken`**, return **`user`** for **`AUTH_SUCCESS`** (Phase 4.1.1–4.1.2).
 */
export async function createBusiness(
  formData: FormData,
): Promise<CreateBusinessSuccess> {
  try {
    const { data } = await http.post<CreateBusinessResponseBody>(
      "/api/v1/business",
      formData,
      multipartFormDataConfig,
    );

    if (!data?.user || data.user.type !== "business") {
      throw new Error(data?.message ?? "Business registration failed");
    }

    if (data.accessToken) {
      setAccessToken(data.accessToken);
    }

    return {
      message: data.message,
      accessToken: data.accessToken,
      user: data.user,
    };
  } catch (e) {
    if (axios.isAxiosError(e)) {
      const body = e.response?.data as { message?: string } | undefined;
      const msg = body?.message ?? e.message;
      throw new Error(
        typeof msg === "string" ? msg : "Business registration failed",
      );
    }
    throw e;
  }
}

export function useCreateBusinessMutation() {
  return useMutation({
    mutationFn: createBusiness,
  });
}

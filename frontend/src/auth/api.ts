import type { AuthSession, AuthUser, LoginCredentials } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
let accessToken: string | null = null;

interface AuthApiPayload {
  accessToken?: string;
  user?: AuthUser;
  message?: string;
}

async function parseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.tson()) as T;
  } catch {
    return null;
  }
}

function getAuthHeaders(headers?: HeadersInit): HeadersInit {
  const nextHeaders = new Headers(headers);
  nextHeaders.set("Content-Type", "application/json");

  if (accessToken) {
    nextHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  return nextHeaders;
}

async function authRequest<T>(
  path: string,
  options?: RequestInit,
  retryOnUnauthorized = true
): Promise<{ ok: true; data: T | null } | { ok: false; error: string }> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: getAuthHeaders(options?.headers),
    ...options,
  });

  const payload = await parseJson<{ message?: string } & T>(response);

  if (response.status === 401 && retryOnUnauthorized) {
    const refreshed = await refreshSession();

    if (refreshed.ok) {
      return authRequest<T>(path, options, false);
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      error: payload?.message ?? "Request failed",
    };
  }

  return { ok: true, data: payload };
}

export async function login(credentials: LoginCredentials) {
  const result = await authRequest<AuthApiPayload>(
    "/api/v1/auth/login",
    {
      method: "POST",
      body: JSON.stringify(credentials),
    },
    false
  );

  if (result.ok) {
    accessToken = result.data?.accessToken ?? null;
    return {
      ok: true as const,
      data: {
        accessToken: result.data?.accessToken,
        user: result.data?.user ?? null,
      } satisfies AuthSession,
    };
  }

  return result;
}

export async function refreshSession() {
  const result = await authRequest<AuthApiPayload>(
    "/api/v1/auth/refresh",
    {
      method: "POST",
    },
    false
  );

  if (result.ok) {
    accessToken = result.data?.accessToken ?? null;
    return {
      ok: true as const,
      data: {
        accessToken: result.data?.accessToken,
        user: result.data?.user ?? null,
      } satisfies AuthSession,
    };
  }

  accessToken = null;
  return result;
}

export async function getCurrentUser() {
  const result = await authRequest<{ user?: AuthUser }>("/api/v1/auth/me", {
    method: "GET",
  });

  if (result.ok) {
    return { ok: true as const, data: result.data?.user ?? null };
  }

  return result;
}

export async function logout() {
  const result = await authRequest<{ message?: string }>(
    "/api/v1/auth/logout",
    {
      method: "POST",
    },
    false
  );

  accessToken = null;
  return result;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

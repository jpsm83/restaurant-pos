import type { NotificationItem } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

interface NotificationsQuery {
  page?: number;
  limit?: number;
}

const toPositiveInt = (value: number | undefined, fallback: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : fallback;
};

const buildNotificationsPath = (userId: string, query?: NotificationsQuery): string => {
  const page = toPositiveInt(query?.page, 1);
  const limit = toPositiveInt(query?.limit, 20);
  return `${API_BASE_URL}/api/v1/notifications/user/${userId}?page=${page}&limit=${limit}`;
};

export async function fetchUserNotifications(
  userId: string,
  accessToken: string,
  query?: NotificationsQuery
): Promise<{ ok: true; data: NotificationItem[] } | { ok: false; error: string }> {
  const response = await fetch(buildNotificationsPath(userId, query), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
  });

  if (!response.ok) {
    return { ok: false, error: `Failed to fetch notifications (${response.status})` };
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    return { ok: false, error: "Unexpected notifications payload" };
  }

  return {
    ok: true,
    data: payload as NotificationItem[],
  };
}


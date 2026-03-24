import type { NotificationLiveMessage } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

const toWsBase = (baseUrl: string): string => {
  if (!baseUrl) return "";
  if (baseUrl.startsWith("https://")) return `wss://${baseUrl.slice("https://".length)}`;
  if (baseUrl.startsWith("http://")) return `ws://${baseUrl.slice("http://".length)}`;
  return baseUrl;
};

export const getNotificationsLiveUrl = (): string =>
  `${toWsBase(API_BASE_URL)}/api/v1/notifications/live`;

export const buildNotificationsLiveUrlWithToken = (accessToken: string): string => {
  const base = getNotificationsLiveUrl();
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}access_token=${encodeURIComponent(accessToken)}`;
};

export const getReconnectDelayMs = (attempt: number): number => {
  const normalizedAttempt = Math.max(0, attempt);
  const base = 500;
  const max = 10_000;
  return Math.min(max, base * 2 ** normalizedAttempt);
};

export const parseNotificationsLiveMessage = (
  raw: string
): NotificationLiveMessage | null => {
  try {
    return JSON.parse(raw) as NotificationLiveMessage;
  } catch {
    return null;
  }
};


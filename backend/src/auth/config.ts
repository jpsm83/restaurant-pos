/**
 * Auth Configuration - JWT secrets and token expiration
 */

export const AUTH_CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET || process.env.AUTH_SECRET || "dev-jwt-secret",
  REFRESH_SECRET: process.env.REFRESH_SECRET || "dev-refresh-secret",
  ACCESS_TOKEN_EXPIRES_IN: "15m",
  REFRESH_TOKEN_EXPIRES_IN: "7d",
  REFRESH_COOKIE_NAME: "refresh_token",
  AUTH_MODE_COOKIE_NAME: "auth_mode",
  COOKIE_MAX_AGE_SECONDS: 60 * 60 * 24 * 7, // 7 days
} as const;

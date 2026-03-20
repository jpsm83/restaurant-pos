/**
 * Auth Module - Exports for authentication utilities
 */

export { AUTH_CONFIG } from "./config.ts";
export { canLogAsEmployee, type CanLogAsEmployeeResult } from "./canLogAsEmployee.ts";
export { getEffectiveUserRoleAtTime, type EffectiveUserRole } from "./getEffectiveUserRoleAtTime.ts";
export {
  createAuthHook,
  createOptionalAuthHook,
  requireBusinessHook,
  requireManagementHook,
  requireEmployeeHook,
  hasBusinessAccess,
  getSessionBusinessId,
} from "./middleware.ts";
export type {
  AuthBusiness,
  AuthUser,
  AuthSession,
  JwtPayload,
  RefreshTokenPayload,
} from "./types.ts";

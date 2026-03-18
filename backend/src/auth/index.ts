/**
 * Auth Module - Exports for authentication utilities
 */

export { AUTH_CONFIG } from "./config.js";
export { canLogAsEmployee, type CanLogAsEmployeeResult } from "./canLogAsEmployee.js";
export {
  createAuthHook,
  createOptionalAuthHook,
  requireBusinessHook,
  requireManagementHook,
  requireEmployeeHook,
  hasBusinessAccess,
  getSessionBusinessId,
} from "./middleware.js";
export type {
  AuthBusiness,
  AuthUser,
  AuthSession,
  JwtPayload,
  RefreshTokenPayload,
} from "./types.js";

/**
 * Shared auth-mode contracts for frontend/backend integration.
 */
import type {
  AccessCapabilityKey,
  AccessLayer,
} from "../access.ts";

export type IAuthMode = "customer" | "business";

export interface IAuthModeResponse {
  mode?: IAuthMode;
}

export interface ISetAuthModeBody {
  mode: IAuthMode;
}

/** Unauthenticated auth-surface availability. */
export interface IAuthConfigResponse {
  googleSignInEnabled: boolean;
}

/** Where the signed-in User's access to one venue comes from. */
export type IAuthVenueAccessSource = "ownership" | "membership";

/**
 * One venue the signed-in User may enter. Ownership wins over a membership at
 * the same venue; a schedule-gated membership stays listed with
 * `canEnterBusiness` false so the chrome can explain why Business is closed.
 */
export interface IAuthAccessibleVenue {
  businessId: string;
  tradeName: string;
  source: IAuthVenueAccessSource;
  effectiveLayer: AccessLayer;
  jobRoles: string[];
  capabilities: AccessCapabilityKey[];
  canEnterBusiness: boolean;
}

/** The signed-in User's accessible venues, owned venues first. */
export interface IAuthAccessibleVenuesResponse {
  venues: IAuthAccessibleVenue[];
}

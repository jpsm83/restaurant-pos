/**
 * Shared auth-mode contracts for frontend/backend integration.
 */
export type IAuthMode = "customer" | "employee";

export interface IAuthModeResponse {
  mode?: string;
}

export interface ISetAuthModeBody {
  mode: IAuthMode;
}

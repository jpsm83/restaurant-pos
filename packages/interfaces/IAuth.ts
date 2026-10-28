/**
 * Shared auth-mode contracts for frontend/backend integration.
 */
export type IAuthMode = "customer" | "business";

export interface IAuthModeResponse {
  mode?: IAuthMode;
}

export interface ISetAuthModeBody {
  mode: IAuthMode;
}

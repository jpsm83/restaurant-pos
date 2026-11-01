/**
 * The signed-in User's accessible venue list — one read for the app chrome.
 *
 * ## Flow
 * - **`getAccessibleVenues`** — `GET /api/v1/auth/venues` through shared `http`.
 * - **`useAccessibleVenuesQuery`** — caches the list under the stable
 *   `queryKeys.auth.venues()` key, enabled only while a User is signed in.
 *
 * The server unions owned and member venues, applies the effective-access
 * resolver, and orders them deterministically; this service only types and
 * transports that shape.
 */
import { useQuery } from "@tanstack/react-query";
import type {
  IAuthAccessibleVenue,
  IAuthAccessibleVenuesResponse,
} from "restaurant-pos-packages/interfaces/IAuth";
import { http } from "./http";
import { queryKeys } from "./queryKeys";
import { toServiceRequestError } from "./serviceErrors";

/** `GET /api/v1/auth/venues` — reads only the session User's venues. */
export async function getAccessibleVenues(
  signal?: AbortSignal,
): Promise<IAuthAccessibleVenue[]> {
  try {
    const { data } = await http.get<IAuthAccessibleVenuesResponse>(
      "/api/v1/auth/venues",
      { signal },
    );
    return Array.isArray(data.venues) ? data.venues : [];
  } catch (error) {
    throw toServiceRequestError(error, "venuesLoad");
  }
}

export function useAccessibleVenuesQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.auth.venues(),
    queryFn: ({ signal }) => getAccessibleVenues(signal),
    enabled: options?.enabled ?? true,
  });
}

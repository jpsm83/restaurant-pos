import type { IAuthAccessibleVenue } from "restaurant-pos-packages/interfaces/IAuth";

/** The first venue in server order the signed-in User may enter right now. */
export function findFirstEnterableVenue(
  venues: readonly IAuthAccessibleVenue[],
): IAuthAccessibleVenue | undefined {
  return venues.find((venue) => venue.canEnterBusiness);
}

/**
 * Shared cooldown for account one-time-link requests.
 *
 * Every purpose stores its own `requestedAt` timestamp on the account it
 * belongs to. A repeat request inside this window sends nothing, writes no new
 * link, and leaves the live link untouched.
 */
export const REQUEST_COOLDOWN_MS = 60 * 1000;

/**
 * Whether an account requested this link purpose inside the cooldown window.
 * A missing timestamp never blocks a request.
 */
export function isRequestWithinCooldown(
  requestedAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!(requestedAt instanceof Date)) return false;
  return now.getTime() - requestedAt.getTime() < REQUEST_COOLDOWN_MS;
}

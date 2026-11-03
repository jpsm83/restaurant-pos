/**
 * Shared cooldown for account one-time-link requests.
 *
 * Every purpose stores its own `requestedAt` timestamp on the account it
 * belongs to. A repeat request inside this window sends nothing, writes no new
 * link, and leaves the live link untouched.
 */
import type { Model, QueryFilter, UpdateQuery } from "mongoose";

export const REQUEST_COOLDOWN_MS = 60 * 1000;

/**
 * Atomically claims one send slot by writing the token state only when the
 * purpose's `requestedAt` is missing or older than the cooldown. Of concurrent
 * requests on the same document exactly one matches and returns `true`.
 */
export async function claimRequestCooldown<T>(
  model: Model<T>,
  filter: Record<string, unknown>,
  requestedAtField: string,
  update: Record<string, unknown>,
  now: Date = new Date(),
): Promise<boolean> {
  const cutoff = new Date(now.getTime() - REQUEST_COOLDOWN_MS);

  const claimed = await model.findOneAndUpdate(
    {
      ...filter,
      $or: [
        { [requestedAtField]: { $exists: false } },
        { [requestedAtField]: null },
        { [requestedAtField]: { $lte: cutoff } },
      ],
    } as QueryFilter<T>,
    update as UpdateQuery<T>,
    { returnDocument: "after" },
  );

  return claimed !== null;
}

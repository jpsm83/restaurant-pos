import mongoose, { type ClientSession } from "mongoose";
import { isTransientMongoClusterError } from "./transientClusterError.ts";

const MAX_ATTEMPTS = 4;

export type TxnHttpAbort = {
  type: "http";
  status: number;
  body: Record<string, unknown>;
};

export type TxnRunOutcome<T> = TxnHttpAbort | { type: "commit"; value: T };

/**
 * Runs work in a transaction; retries only on transient MongoDB cluster errors.
 * Caller maps business exits to `{ type: "http", ... }` so those are not retried.
 */
export async function runTxnWithTransientRetry<T>(
  run: (session: ClientSession) => Promise<TxnRunOutcome<T>>,
): Promise<TxnRunOutcome<T>> {
  let last: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const outcome = await run(session);
      if (outcome.type === "http") {
        await session.abortTransaction();
        return outcome;
      }
      await session.commitTransaction();
      return outcome;
    } catch (err) {
      await session.abortTransaction().catch(() => {});
      if (isTransientMongoClusterError(err) && attempt < MAX_ATTEMPTS - 1) {
        last = err;
        await new Promise((r) => setTimeout(r, 45 * (attempt + 1)));
        continue;
      }
      throw err;
    } finally {
      session.endSession();
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

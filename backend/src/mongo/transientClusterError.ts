import { MongoServerError } from "mongodb";

/**
 * True for errors that may succeed if the same transactional work is retried.
 * Common with MongoMemoryReplSet and rare with a stable replica set / standalone.
 */
export function isTransientMongoClusterError(err: unknown): boolean {
  if (err instanceof MongoServerError) {
    if (typeof err.hasErrorLabel === "function") {
      if (
        err.hasErrorLabel("TransientTransactionError") ||
        err.hasErrorLabel("UnknownTransactionCommitResult")
      ) {
        return true;
      }
    }
  }
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("Please retry your operation") ||
    msg.includes("catalog changes") ||
    msg.includes("does not match any in-progress transactions") ||
    msg.includes("WriteConflict") ||
    msg.includes("Unable to acquire IX lock")
  );
}

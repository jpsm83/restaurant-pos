import type { ClientSession } from "mongoose";

/**
 * Runs `callback` only after the session's current transaction commits.
 *
 * The live notification push is best-effort acceleration layered on top of a
 * durable store, so it must never fire for a notification the store might still
 * undo. When the caller delivers inside an open transaction, the push is held
 * until that transaction commits; when the caller is not in a transaction, the
 * callback runs immediately after the successful write.
 *
 * An aborted transaction never commits, so its callbacks never run. Several
 * callbacks registered on one transaction all flush once, in order, after a
 * successful commit.
 */

type DeferredCallback = () => void;

// Queued callbacks per session that is mid-transaction. Keyed weakly so a
// session that is garbage-collected drops its queue without a manual cleanup.
const pendingBySession = new WeakMap<ClientSession, DeferredCallback[]>();

export const runAfterCommit = (
  session: ClientSession | undefined,
  callback: DeferredCallback,
): void => {
  if (!session || !session.inTransaction()) {
    callback();
    return;
  }

  const existing = pendingBySession.get(session);
  if (existing) {
    existing.push(callback);
    return;
  }

  const queue: DeferredCallback[] = [callback];
  pendingBySession.set(session, queue);

  const originalCommit = session.commitTransaction.bind(session);
  const originalAbort = session.abortTransaction.bind(session);

  const restore = (): void => {
    pendingBySession.delete(session);
    session.commitTransaction = originalCommit;
    session.abortTransaction = originalAbort;
  };

  session.commitTransaction = async function patchedCommit(this: ClientSession) {
    // Run the real commit first. If it throws (including an
    // `UnknownTransactionCommitResult` the caller may retry on this same
    // session), the patch and queue stay in place so a retried commit still
    // flushes exactly once. Flush and restore only once the store has committed.
    const result = await originalCommit();
    restore();
    for (const queued of queue) {
      queued();
    }
    return result;
  } as ClientSession["commitTransaction"];

  session.abortTransaction = async function patchedAbort(this: ClientSession) {
    // A rolled-back transaction drops its pending pushes without firing them.
    restore();
    return originalAbort();
  } as ClientSession["abortTransaction"];
};

export default runAfterCommit;

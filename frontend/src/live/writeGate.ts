/**
 * Client write gate: a signed-in tab may commit a domain write only while
 * its live connection is open and resynced. Guests are not gated. There is
 * no offline write queue — a blocked attempt is rejected now and forgotten.
 */
import i18n from "@/i18n/i18n";
import { canCommitWrite as connectionCanCommitWrite } from "./connection";

export const WRITE_BLOCKED_CODE = "LIVE_WRITE_BLOCKED";

export const WRITE_BLOCKED_MESSAGE =
  "This action is blocked until the connection is live again.";

export class WriteBlockedError extends Error {
  readonly code = WRITE_BLOCKED_CODE;

  constructor(message = WRITE_BLOCKED_MESSAGE) {
    super(message);
    this.name = "WriteBlockedError";
  }
}

export function canCommitWrite(): boolean {
  return connectionCanCommitWrite();
}

export function assertWritesAllowed(): void {
  if (!canCommitWrite()) {
    throw new WriteBlockedError(
      i18n.t("live.writeBlocked", { defaultValue: WRITE_BLOCKED_MESSAGE }),
    );
  }
}

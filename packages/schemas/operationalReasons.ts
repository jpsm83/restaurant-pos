/**
 * Shared request fields for an operational-reason selection.
 *
 * `reasonCode` is a required sanitized string wherever the act needs a reason.
 * `reasonNote` is optional free text, sanitized like any other free text, blank
 * treated as absent, and capped at 280 characters. Whether a note is allowed
 * (only with `other`) and whether the code belongs to the act are cross-field
 * rules owned by the catalogue resolver, not these field schemas.
 */
import { z } from "zod";

import {
  emptyToUndefined,
  freeTextString,
  sanitizedString,
} from "./primitives.ts";

const REASON_NOTE_MAX_LENGTH = 280;

/** One selected code from the act's closed operational-reason catalogue. */
export const reasonCode = sanitizedString("Reason code is required");

/** The optional Other note: sanitized, blank-to-absent, capped at 280 chars. */
export const reasonNote = z.preprocess(
  emptyToUndefined,
  freeTextString()
    .max(
      REASON_NOTE_MAX_LENGTH,
      `Reason note must be ${REASON_NOTE_MAX_LENGTH} characters or fewer`,
    )
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
);

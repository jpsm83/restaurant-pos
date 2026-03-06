/**
 * isObjectIdValid — MongoDB ObjectId array validator
 *
 * Checks that an array of ids are non-empty and each element is a valid
 * 24-char hex ObjectId. Used before DB lookups or references (e.g. order IDs,
 * user IDs) to avoid invalid ObjectId errors and bad queries. Necessary for
 * safe, predictable API and DB behaviour when accepting id arrays from
 * clients or internal callers.
 */

import { Types } from "mongoose";

/**
 * Returns true only if ids is a non-empty array and every element passes
 * Types.ObjectId.isValid. Accepts string[] or Types.ObjectId[].
 */
const isObjectIdValid = (ids: string[] | Types.ObjectId[]) => {
  if (!ids || ids.length === 0) {
    return false;
  }

  for (const id of ids) {
    if (!id || !Types.ObjectId.isValid(id)) {
      return false;
    }
  }
  return true;
};

export default isObjectIdValid;

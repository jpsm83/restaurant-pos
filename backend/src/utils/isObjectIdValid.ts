/**
 * isObjectIdValid — array-body ObjectId guard.
 *
 * Boundary validation uses the shared zod `objectIdSchema`, which covers single
 * IDs. This mongoose-based guard remains only for the array-body case: a
 * post-parse check over ids drawn from an array field of a request body (the
 * order array, purchase items, `userIds`, `setMenuIds`), where the entries may
 * be `Types.ObjectId` instances rather than strings.
 */
import { Types } from "mongoose";

const isObjectIdValid = (ids: Array<string | Types.ObjectId>): boolean => {
  if (!ids || ids.length === 0) return false;
  for (const id of ids) {
    if (!id || !Types.ObjectId.isValid(id)) return false;
  }
  return true;
};

export default isObjectIdValid;

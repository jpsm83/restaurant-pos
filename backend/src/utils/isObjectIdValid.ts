import { Types } from "mongoose";

export function isObjectIdValid(ids: Array<string | Types.ObjectId>): boolean {
  if (!ids || ids.length === 0) return false;
  for (const id of ids) {
    if (!id || !Types.ObjectId.isValid(id)) return false;
  }
  return true;
}


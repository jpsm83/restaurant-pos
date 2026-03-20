import { Types } from "mongoose";

const isObjectIdValid = (ids: Array<string | Types.ObjectId>): boolean => {
  if (!ids || ids.length === 0) return false;
  for (const id of ids) {
    if (!id || !Types.ObjectId.isValid(id)) return false;
  }
  return true;
};

export default isObjectIdValid;

import { Types } from "mongoose";
import { toUniqueObjectIds } from "./utils.ts";

const resolveCustomerUserRecipient = (
  customerUserIds: (Types.ObjectId | string)[] = []
): Types.ObjectId[] => {
  return toUniqueObjectIds(customerUserIds);
};

export default resolveCustomerUserRecipient;


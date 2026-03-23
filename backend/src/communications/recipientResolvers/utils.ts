import { Types } from "mongoose";

export const toUniqueObjectIds = (
  values: (Types.ObjectId | string | null | undefined)[]
): Types.ObjectId[] => {
  const unique = new Map<string, Types.ObjectId>();

  values.forEach((value) => {
    if (!value) return;
    const objectId =
      value instanceof Types.ObjectId ? value : new Types.ObjectId(value);
    unique.set(objectId.toString(), objectId);
  });

  return Array.from(unique.values());
};


import { type Model } from "mongoose";

export const softDeleteSchemaFields = {
  deleted: {
    type: Boolean,
    default: false,
    index: true,
  },
  deletedAt: {
    type: Date,
    default: undefined,
  },
} as const;

type SoftDeleteRecord = {
  deleted: boolean;
  deletedAt?: Date;
};

/**
 * Active-only reads are the default; callers must opt in to include deleted.
 */
export function withSoftDeleteFilter(
  filter: Record<string, unknown>,
  includeDeleted = false,
): Record<string, unknown> {
  if (includeDeleted) {
    return filter;
  }

  return {
    ...filter,
    deleted: { $ne: true },
  };
}

/**
 * Marks a document as deleted if it is currently active.
 */
export async function markAsDeletedById<TRecord extends SoftDeleteRecord>(
  model: Model<TRecord>,
  id: string,
): Promise<boolean> {
  const result = await model.updateOne(
    { _id: id, deleted: { $ne: true } },
    {
      $set: {
        deleted: true,
        deletedAt: new Date(),
      },
    },
  );

  return result.modifiedCount === 1;
}

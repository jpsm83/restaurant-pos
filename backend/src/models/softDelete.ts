import {
  Schema,
  type ClientSession,
  type Model,
  type Query,
} from "mongoose";

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
  /** Authenticated account id (User or Business) that marked the row deleted. */
  deletedBy: {
    type: Schema.Types.ObjectId,
    default: undefined,
  },
} as const;

/**
 * Ordinary finds, counts, and updates. `deleteOne` and `deleteMany` stay
 * unhooked so the two ADR-0003 discards can still remove a document.
 */
const ACTIVE_ONLY_QUERY_HOOKS = [
  "count",
  "countDocuments",
  "find",
  "findOne",
  "findOneAndReplace",
  "findOneAndUpdate",
  "replaceOne",
  "updateMany",
  "updateOne",
] as const;

/**
 * Hides soft-deleted rows unless the filter already names `deleted` or the
 * query sets `{ includeDeleted: true }`. An existing active-only `deleted`
 * clause is left as-is.
 */
export function applyActiveOnlySoftDelete(schema: Schema): void {
  for (const hook of ACTIVE_ONLY_QUERY_HOOKS) {
    schema.pre(hook as "find", function (this: Query<unknown, unknown>) {
      const options = this.getOptions() as { includeDeleted?: boolean };
      if (options.includeDeleted === true) {
        return;
      }

      const filter = this.getFilter() as Record<string, unknown>;
      if (Object.prototype.hasOwnProperty.call(filter, "deleted")) {
        return;
      }

      this.where({ deleted: { $ne: true } });
    });
  }
}

type SoftDeleteRecord = {
  deleted: boolean;
  deletedAt?: Date;
  deletedBy?: unknown;
};

export type MarkDeletedOptions = {
  session?: ClientSession;
  /** Signed-in User or Business id. Omitted when the delete has no session. */
  deletedBy?: string;
};

function isClientSession(
  value: ClientSession | MarkDeletedOptions,
): value is ClientSession {
  return typeof (value as ClientSession).inTransaction === "function";
}

/**
 * Active-only reads are the default; callers must opt in to include deleted.
 * `includeDeleted` matches every stored state, including rows whose flag is
 * still missing, so the query default does not hide them.
 */
export function withSoftDeleteFilter(
  filter: Record<string, unknown>,
  includeDeleted = false,
): Record<string, unknown> {
  if (includeDeleted) {
    if (Object.prototype.hasOwnProperty.call(filter, "deleted")) {
      return filter;
    }

    return {
      ...filter,
      deleted: { $in: [true, false, null] },
    };
  }

  return {
    ...filter,
    deleted: { $ne: true },
  };
}

/**
 * Marks a document as deleted if it is currently active.
 * Pass the surrounding transaction session so a later failure rolls the marker back.
 */
export async function markAsDeletedById<TRecord extends SoftDeleteRecord>(
  model: Model<TRecord>,
  id: string,
  sessionOrOptions?: ClientSession | MarkDeletedOptions,
): Promise<boolean> {
  const options =
    sessionOrOptions == null
      ? undefined
      : isClientSession(sessionOrOptions)
        ? { session: sessionOrOptions }
        : sessionOrOptions;
  const set: {
    deleted: true;
    deletedAt: Date;
    deletedBy?: string;
  } = {
    deleted: true,
    deletedAt: new Date(),
  };
  if (options?.deletedBy) {
    set.deletedBy = options.deletedBy;
  }

  const result = await model.updateOne(
    { _id: id, deleted: { $ne: true } },
    { $set: set },
    options?.session ? { session: options.session } : undefined,
  );

  return result.modifiedCount === 1;
}

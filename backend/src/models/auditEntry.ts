import mongoose, { Schema, model } from "mongoose";

import {
  AUDIT_ACT_KINDS,
  AUDIT_ACTOR_KINDS,
  AUDIT_RETENTION_CLASSES,
  AUDIT_TARGET_KINDS,
} from "../audit/auditCatalogue.ts";

const auditTargetSchema = new Schema(
  {
    kind: {
      type: String,
      required: [true, "Target kind is required!"],
      enum: Object.values(AUDIT_TARGET_KINDS),
    },
    id: {
      type: Schema.Types.ObjectId,
      required: [true, "Target id is required!"],
    },
  },
  { _id: false },
);

/**
 * Append-only ledger record of a controlled act. It deliberately has no
 * soft-delete marker, no backfill entry, and no update or delete route.
 */
const auditEntrySchema = new Schema(
  {
    actorKind: {
      type: String,
      required: [true, "Actor kind is required!"],
      enum: Object.values(AUDIT_ACTOR_KINDS),
    },
    actorId: {
      type: Schema.Types.ObjectId,
      default: undefined,
    },
    actKind: {
      type: String,
      required: [true, "Act kind is required!"],
      enum: Object.values(AUDIT_ACT_KINDS),
    },
    target: {
      type: auditTargetSchema,
      required: [true, "Target is required!"],
    },
    relatedTargets: {
      type: [auditTargetSchema],
      default: undefined,
    },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      default: undefined,
    },
    occurredAt: {
      type: Date,
      required: [true, "Server time is required!"],
    },
    payload: {
      type: Schema.Types.Mixed,
      default: {},
    },
    retentionClass: {
      type: String,
      required: [true, "Retention class is required!"],
      enum: Object.values(AUDIT_RETENTION_CLASSES),
    },
    impersonation: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: false,
    trim: true,
  },
);

// Object-attached reads stay inside one venue and one target, newest first.
auditEntrySchema.index({
  businessId: 1,
  "target.kind": 1,
  "target.id": 1,
  occurredAt: -1,
});

const AuditEntry =
  mongoose.models.AuditEntry || model("AuditEntry", auditEntrySchema);
export default AuditEntry;

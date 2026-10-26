import mongoose, { type ClientSession, Types } from "mongoose";

import AuditEntry from "../models/auditEntry.ts";
import {
  AUDIT_ACTOR_KINDS,
  AUDIT_ACT_KINDS,
  AUDIT_TARGET_KINDS,
  retentionClassForTargetKind,
  type AuditActKind,
  type AuditActorKind,
  type AuditTargetKind,
} from "./auditCatalogue.ts";

export interface AuditActorInput {
  kind: AuditActorKind;
  id?: string | Types.ObjectId | null;
}

export interface AuditTargetInput {
  kind: AuditTargetKind;
  id: string | Types.ObjectId;
}

export interface AuditAppendInput {
  actor: AuditActorInput;
  actKind: AuditActKind;
  /** Primary target: the parent record that decides the retention class. */
  target: AuditTargetInput;
  relatedTargets?: AuditTargetInput[];
  businessId?: string | Types.ObjectId | null;
  /** Server time of the act; the caller never lets a client choose it. */
  occurredAt: Date;
  payload?: unknown;
  impersonation?: boolean;
  session?: ClientSession;
}

export type AuditAppendResult =
  | { success: true; entryId: string }
  | { success: false; error: string };

const ACTOR_KIND_VALUES: ReadonlySet<string> = new Set(
  Object.values(AUDIT_ACTOR_KINDS),
);
const ACT_KIND_VALUES: ReadonlySet<string> = new Set(
  Object.values(AUDIT_ACT_KINDS),
);
const TARGET_KIND_VALUES: ReadonlySet<string> = new Set(
  Object.values(AUDIT_TARGET_KINDS),
);

function isValidId(value: unknown): boolean {
  if (typeof value !== "string" && !(value instanceof Types.ObjectId)) {
    return false;
  }

  return mongoose.isValidObjectId(value);
}

function validateTarget(
  target: Partial<AuditTargetInput> | null | undefined,
): string | null {
  if (!target) {
    return "Audit target is required";
  }

  if (!target.kind) {
    return "Audit target kind is required";
  }

  if (!TARGET_KIND_VALUES.has(target.kind)) {
    return "Audit target kind is invalid";
  }

  if (!isValidId(target.id)) {
    return "Audit target id is required";
  }

  return null;
}

function validateAppendInput(
  input: AuditAppendInput | null | undefined,
): string | null {
  if (!input) {
    return "Audit entry input is required";
  }

  const actor = input.actor as Partial<AuditActorInput> | null | undefined;
  if (!actor) {
    return "Audit actor is required";
  }

  if (!actor.kind) {
    return "Audit actor kind is required";
  }

  if (!ACTOR_KIND_VALUES.has(actor.kind)) {
    return "Audit actor kind is invalid";
  }

  if (actor.kind !== AUDIT_ACTOR_KINDS.SYSTEM && !isValidId(actor.id)) {
    return "Audit actor id is required";
  }

  if (!input.actKind) {
    return "Audit act kind is required";
  }

  if (!ACT_KIND_VALUES.has(input.actKind)) {
    return "Audit act kind is invalid";
  }

  const targetError = validateTarget(
    input.target as Partial<AuditTargetInput> | null | undefined,
  );
  if (targetError) {
    return targetError;
  }

  if (input.relatedTargets != null) {
    if (!Array.isArray(input.relatedTargets)) {
      return "Audit related targets must be a list";
    }

    for (const relatedTarget of input.relatedTargets) {
      const relatedTargetError = validateTarget(relatedTarget);
      if (relatedTargetError) {
        return relatedTargetError;
      }
    }
  }

  if (!input.occurredAt) {
    return "Audit server time is required";
  }

  if (
    !(input.occurredAt instanceof Date) ||
    Number.isNaN(input.occurredAt.getTime())
  ) {
    return "Audit server time is invalid";
  }

  if (input.businessId != null && !isValidId(input.businessId)) {
    return "Audit business id is invalid";
  }

  return null;
}

/**
 * The one append seam. It only inserts: no update and no delete path exists.
 * Incomplete input stores nothing and returns a failed result; a persistence
 * failure is returned the same way so the caller can decide whether the act
 * stands.
 */
export async function appendAuditEntry(
  input: AuditAppendInput | null | undefined,
): Promise<AuditAppendResult> {
  const validationError = validateAppendInput(input);
  if (validationError || !input) {
    return {
      success: false,
      error: validationError ?? "Audit entry input is required",
    };
  }

  const retentionClass = retentionClassForTargetKind(input.target.kind);

  try {
    const [entry] = await AuditEntry.create(
      [
        {
          actorKind: input.actor.kind,
          actorId:
            input.actor.kind === AUDIT_ACTOR_KINDS.SYSTEM
              ? undefined
              : input.actor.id,
          actKind: input.actKind,
          target: input.target,
          relatedTargets: input.relatedTargets,
          businessId: input.businessId ?? undefined,
          occurredAt: input.occurredAt,
          payload: input.payload ?? {},
          retentionClass,
          impersonation: input.impersonation === true,
        },
      ],
      input.session ? { session: input.session } : undefined,
    );

    return { success: true, entryId: String(entry._id) };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Audit entry append failed",
    };
  }
}

import { beforeAll, describe, expect, it } from "vitest";
import mongoose, { Types } from "mongoose";

import AuditEntry from "../../src/models/auditEntry.ts";
import { softDeleteBackfillModels } from "../../src/models/softDeleteBackfillModels.ts";
import {
  appendAuditEntry,
  type AuditAppendInput,
} from "../../src/audit/appendAuditEntry.ts";
import {
  AUDIT_ACT_KINDS,
  AUDIT_ACTOR_KINDS,
  AUDIT_RETENTION_CLASSES,
  AUDIT_TARGET_KINDS,
} from "../../src/audit/auditCatalogue.ts";

type RawAuditEntry = {
  _id: Types.ObjectId;
  actorKind?: string;
  actorId?: Types.ObjectId;
  actKind?: string;
  target?: { kind?: string; id?: Types.ObjectId };
  relatedTargets?: Array<{ kind?: string; id?: Types.ObjectId }>;
  businessId?: Types.ObjectId;
  occurredAt?: Date;
  payload?: Record<string, unknown>;
  retentionClass?: string;
  impersonation?: boolean;
  deleted?: boolean;
  deletedAt?: Date;
};

function validInput(
  overrides: Partial<AuditAppendInput> = {},
): AuditAppendInput {
  return {
    actor: {
      kind: AUDIT_ACTOR_KINDS.USER,
      id: new Types.ObjectId(),
    },
    actKind: AUDIT_ACT_KINDS.PURCHASE_LINE_EDITED,
    target: {
      kind: AUDIT_TARGET_KINDS.PURCHASE,
      id: new Types.ObjectId(),
    },
    occurredAt: new Date("2026-10-26T12:00:00.000Z"),
    payload: { quantityBefore: 1, quantityAfter: 2 },
    ...overrides,
  };
}

async function rawEntries(): Promise<RawAuditEntry[]> {
  return (await mongoose.connection
    .collection("auditentries")
    .find({})
    .toArray()) as unknown as RawAuditEntry[];
}

function sameKey(
  a: Record<string, number> | undefined,
  b: Record<string, number>,
): boolean {
  if (!a) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return bKeys.every((key) => a[key] === b[key]);
}

describe("appendAuditEntry", () => {
  beforeAll(async () => {
    await AuditEntry.syncIndexes();
  });

  it("stores exactly one entry with the payload and derived retention class", async () => {
    const actorId = new Types.ObjectId();
    const businessId = new Types.ObjectId();
    const purchaseId = new Types.ObjectId();
    const lineId = new Types.ObjectId();
    const supplierGoodId = new Types.ObjectId();
    const occurredAt = new Date("2026-10-26T09:30:00.000Z");
    const payload = {
      quantityBefore: 2,
      quantityAfter: 3,
      priceBefore: 10,
      priceAfter: 12,
      reason: "Supplier invoice correction",
    };

    const result = await appendAuditEntry({
      actor: { kind: AUDIT_ACTOR_KINDS.USER, id: actorId },
      actKind: AUDIT_ACT_KINDS.PURCHASE_LINE_EDITED,
      target: { kind: AUDIT_TARGET_KINDS.PURCHASE, id: purchaseId },
      relatedTargets: [
        { kind: AUDIT_TARGET_KINDS.PURCHASE_LINE, id: lineId },
        { kind: AUDIT_TARGET_KINDS.SUPPLIER_GOOD, id: supplierGoodId },
      ],
      businessId,
      occurredAt,
      payload,
    });

    expect(result.success).toBe(true);

    const stored = await rawEntries();
    expect(stored).toHaveLength(1);
    const [entry] = stored;
    expect(entry.actorKind).toBe(AUDIT_ACTOR_KINDS.USER);
    expect(String(entry.actorId)).toBe(String(actorId));
    expect(entry.actKind).toBe(AUDIT_ACT_KINDS.PURCHASE_LINE_EDITED);
    expect(entry.target?.kind).toBe(AUDIT_TARGET_KINDS.PURCHASE);
    expect(String(entry.target?.id)).toBe(String(purchaseId));
    expect(entry.relatedTargets).toHaveLength(2);
    expect(String(entry.businessId)).toBe(String(businessId));
    expect(entry.occurredAt?.toISOString()).toBe(occurredAt.toISOString());
    expect(entry.payload).toEqual(payload);
    expect(entry.retentionClass).toBe(
      AUDIT_RETENTION_CLASSES.LEGAL_AND_FINANCIAL,
    );
    expect(entry.impersonation).toBe(false);
  });

  it("stores a second entry and leaves the first unchanged", async () => {
    const first = await appendAuditEntry(
      validInput({ payload: { revision: 1 } }),
    );
    const second = await appendAuditEntry(
      validInput({
        target: {
          kind: AUDIT_TARGET_KINDS.INVENTORY,
          id: new Types.ObjectId(),
        },
        actKind: AUDIT_ACT_KINDS.INVENTORY_COUNT_REEDITED,
        payload: { revision: 2 },
      }),
    );

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;

    const stored = await rawEntries();
    expect(stored).toHaveLength(2);

    const firstEntry = stored.find(
      (entry) => String(entry._id) === first.entryId,
    );
    const secondEntry = stored.find(
      (entry) => String(entry._id) === second.entryId,
    );
    expect(firstEntry?.payload).toEqual({ revision: 1 });
    expect(firstEntry?.actKind).toBe(AUDIT_ACT_KINDS.PURCHASE_LINE_EDITED);
    expect(secondEntry?.payload).toEqual({ revision: 2 });
    expect(secondEntry?.actKind).toBe(
      AUDIT_ACT_KINDS.INVENTORY_COUNT_REEDITED,
    );
  });

  it("stores nothing and returns a failed result for incomplete input", async () => {
    const missingActor = validInput() as unknown as Record<string, unknown>;
    delete missingActor.actor;

    const missingActorKind = validInput({
      actor: { id: new Types.ObjectId() } as never,
    });

    const missingActKind = validInput() as unknown as Record<string, unknown>;
    delete missingActKind.actKind;

    const missingTarget = validInput() as unknown as Record<string, unknown>;
    delete missingTarget.target;

    const missingTime = validInput() as unknown as Record<string, unknown>;
    delete missingTime.occurredAt;

    const malformedRelatedTargets = validInput({
      relatedTargets: {} as never,
    });

    const incompleteInputs = [
      missingActor,
      missingActorKind,
      missingActKind,
      missingTarget,
      missingTime,
      malformedRelatedTargets,
    ] as unknown as AuditAppendInput[];

    for (const input of incompleteInputs) {
      const result = await appendAuditEntry(input);
      expect(result.success).toBe(false);
      expect(result.success ? "" : result.error).toBeTruthy();
    }

    expect(await rawEntries()).toHaveLength(0);
  });

  it("exposes no update or delete path", async () => {
    const auditModule = await import("../../src/audit/appendAuditEntry.ts");

    expect(Object.keys(auditModule)).toEqual(["appendAuditEntry"]);
    expect(
      (auditModule as unknown as Record<string, unknown>).update,
    ).toBeUndefined();
    expect(
      (auditModule as unknown as Record<string, unknown>).delete,
    ).toBeUndefined();
  });

  it("stores no soft-delete marker and is not in the backfill set", async () => {
    const result = await appendAuditEntry(validInput());
    expect(result.success).toBe(true);

    const [entry] = await rawEntries();
    expect(entry.deleted).toBeUndefined();
    expect(entry.deletedAt).toBeUndefined();
    expect(
      softDeleteBackfillModels.some(({ label }) => label === "AuditEntry"),
    ).toBe(false);
  });

  it("carries an optional business id only when the act belongs to a venue", async () => {
    const withoutBusiness = await appendAuditEntry(
      validInput({
        target: {
          kind: AUDIT_TARGET_KINDS.USER,
          id: new Types.ObjectId(),
        },
      }),
    );
    const businessId = new Types.ObjectId();
    const withBusiness = await appendAuditEntry(
      validInput({ businessId }),
    );

    expect(withoutBusiness.success).toBe(true);
    expect(withBusiness.success).toBe(true);

    const stored = await rawEntries();
    expect(stored).toHaveLength(2);
    const venueOwned = stored.find(
      (entry) => String(entry.businessId) === String(businessId),
    );
    const accountScoped = stored.find((entry) => entry.businessId == null);
    expect(venueOwned).toBeDefined();
    expect(accountScoped).toBeDefined();
  });

  it("derives the retention class from the parent kind", async () => {
    const cases: Array<{
      targetKind: (typeof AUDIT_TARGET_KINDS)[keyof typeof AUDIT_TARGET_KINDS];
      expected: (typeof AUDIT_RETENTION_CLASSES)[keyof typeof AUDIT_RETENTION_CLASSES];
    }> = [
      {
        targetKind: AUDIT_TARGET_KINDS.BUSINESS,
        expected: AUDIT_RETENTION_CLASSES.OPERATIONAL,
      },
      {
        targetKind: AUDIT_TARGET_KINDS.USER,
        expected: AUDIT_RETENTION_CLASSES.OPERATIONAL,
      },
      {
        targetKind: AUDIT_TARGET_KINDS.PURCHASE,
        expected: AUDIT_RETENTION_CLASSES.LEGAL_AND_FINANCIAL,
      },
      {
        targetKind: AUDIT_TARGET_KINDS.INVENTORY,
        expected: AUDIT_RETENTION_CLASSES.LEGAL_AND_FINANCIAL,
      },
    ];

    for (const testCase of cases) {
      const result = await appendAuditEntry(
        validInput({
          target: {
            kind: testCase.targetKind,
            id: new Types.ObjectId(),
          },
        }),
      );
      expect(result.success).toBe(true);
      if (!result.success) continue;

      const stored = (await rawEntries()).find(
        (entry) => String(entry._id) === result.entryId,
      );
      expect(stored?.retentionClass).toBe(testCase.expected);
    }
  });

  it("uses the system actor when no account is known", async () => {
    const result = await appendAuditEntry(
      validInput({
        actor: { kind: AUDIT_ACTOR_KINDS.SYSTEM },
        target: { kind: AUDIT_TARGET_KINDS.USER, id: new Types.ObjectId() },
      }),
    );

    expect(result.success).toBe(true);
    const [entry] = await rawEntries();
    expect(entry.actorKind).toBe(AUDIT_ACTOR_KINDS.SYSTEM);
    expect(entry.actorId).toBeUndefined();
  });

  it("accepts the impersonation mark and defaults it off", async () => {
    await appendAuditEntry(validInput());
    const marked = await appendAuditEntry(
      validInput({ impersonation: true }),
    );

    expect(marked.success).toBe(true);
    const stored = await rawEntries();
    expect(stored.filter((entry) => entry.impersonation === false)).toHaveLength(
      1,
    );
    expect(stored.filter((entry) => entry.impersonation === true)).toHaveLength(
      1,
    );
  });

  it("declares the business + target kind/id + server-time index", async () => {
    const indexes = await AuditEntry.collection.listIndexes().toArray();
    const match = indexes.find((index) =>
      sameKey(index.key as Record<string, number> | undefined, {
        businessId: 1,
        "target.kind": 1,
        "target.id": 1,
        occurredAt: -1,
      }),
    );

    expect(match).toBeDefined();
  });

  it("exports the actor, target, act, and retention catalogues", () => {
    expect(Object.values(AUDIT_ACTOR_KINDS)).toEqual([
      "user",
      "business",
      "system",
    ]);
    expect(AUDIT_TARGET_KINDS.BUSINESS).toBe("Business");
    expect(AUDIT_TARGET_KINDS.PURCHASE).toBe("Purchase");
    expect(AUDIT_ACT_KINDS.PURCHASE_LINE_EDITED).toBe("purchase.lineEdited");
    expect(AUDIT_RETENTION_CLASSES.LEGAL_AND_FINANCIAL).toBe(
      "legalAndFinancial",
    );
  });
});

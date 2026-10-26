/**
 * Closed, platform-defined operational-reason catalogues.
 *
 * These are product data, not venue data: a product amendment changes this
 * module. There is no database collection, seed, migration, editor, or HTTP
 * catalogue route, and venues cannot add, rename, or remove a reason code.
 *
 * Every catalogue is closed and contains exactly one `other` entry. `other` is
 * the only entry that allows an optional free-text note; every other code must
 * stand alone. A retired entry stays readable on historical acts but the
 * resolver refuses it for a new selection.
 */

export const OPERATIONAL_REASON_ACTS = {
  VOID: "void",
  INVITATION: "invitation",
  MANUAL_DISCOUNT: "manualDiscount",
  REFUND: "refund",
  COUNT_REEDIT: "countReedit",
  GIFT_CARD_VOID: "giftCardVoid",
  DAILY_REOPEN: "dailyReopen",
} as const;

export type OperationalReasonAct =
  (typeof OPERATIONAL_REASON_ACTS)[keyof typeof OPERATIONAL_REASON_ACTS];

export interface OperationalReasonEntry {
  /** Stable machine code recorded on the act. Never reworded with the label. */
  code: string;
  /** Canonical English label shown to staff. */
  label: string;
  /** Retired codes remain readable on history but are not selectable. */
  retired?: boolean;
  /** True only for the catalogue's single `other` entry. */
  allowsNote: boolean;
}

export type OperationalReasonCatalogues = Record<
  string,
  readonly OperationalReasonEntry[]
>;

/** The one entry every catalogue shares: the only code that allows a note. */
const OTHER_REASON = {
  code: "other",
  label: "Other",
  allowsNote: true,
} as const;

export const OPERATIONAL_REASON_CATALOGUES: Readonly<
  Record<OperationalReasonAct, readonly OperationalReasonEntry[]>
> = {
  [OPERATIONAL_REASON_ACTS.VOID]: [
    { code: "wrongItem", label: "Wrong item", allowsNote: false },
    {
      code: "customerChangedMind",
      label: "Customer changed mind",
      allowsNote: false,
    },
    {
      code: "kitchenPrepError",
      label: "Kitchen / prep error",
      allowsNote: false,
    },
    { code: "outOfStock", label: "Out of stock", allowsNote: false },
    { code: "duplicateEntry", label: "Duplicate entry", allowsNote: false },
    { code: "trainingTest", label: "Training / test", allowsNote: false },
    OTHER_REASON,
  ],
  [OPERATIONAL_REASON_ACTS.INVITATION]: [
    { code: "guestRecovery", label: "Guest recovery", allowsNote: false },
    {
      code: "staffEmployeeMeal",
      label: "Staff / employee meal",
      allowsNote: false,
    },
    {
      code: "ownerManagerDiscretion",
      label: "Owner or manager discretion",
      allowsNote: false,
    },
    { code: "vipMarketing", label: "VIP / marketing", allowsNote: false },
    { code: "supplierPartner", label: "Supplier or partner", allowsNote: false },
    OTHER_REASON,
  ],
  [OPERATIONAL_REASON_ACTS.MANUAL_DISCOUNT]: [
    { code: "guestRecovery", label: "Guest recovery", allowsNote: false },
    {
      code: "priceMatchMissingPromotion",
      label: "Price match / missing promotion",
      allowsNote: false,
    },
    {
      code: "managerDiscretion",
      label: "Manager discretion",
      allowsNote: false,
    },
    {
      code: "serviceRecovery",
      label: "Service recovery",
      allowsNote: false,
    },
    OTHER_REASON,
  ],
  [OPERATIONAL_REASON_ACTS.REFUND]: [
    {
      code: "customerDissatisfaction",
      label: "Customer dissatisfaction",
      allowsNote: false,
    },
    {
      code: "wrongOrderOrCharge",
      label: "Wrong order or charge",
      allowsNote: false,
    },
    {
      code: "itemUnavailableAfterPayment",
      label: "Item unavailable after payment",
      allowsNote: false,
    },
    { code: "duplicateCharge", label: "Duplicate charge", allowsNote: false },
    {
      code: "cancelledAfterPayment",
      label: "Cancelled after payment",
      allowsNote: false,
    },
    OTHER_REASON,
  ],
  [OPERATIONAL_REASON_ACTS.COUNT_REEDIT]: [
    { code: "miscount", label: "Miscount", allowsNote: false },
    { code: "wrongUnit", label: "Wrong unit", allowsNote: false },
    { code: "wrongItem", label: "Wrong item", allowsNote: false },
    {
      code: "goodsArrivedAfterCount",
      label: "Goods arrived after count",
      allowsNote: false,
    },
    { code: "entryError", label: "Entry error", allowsNote: false },
    OTHER_REASON,
  ],
  [OPERATIONAL_REASON_ACTS.GIFT_CARD_VOID]: [
    { code: "issuedInError", label: "Issued in error", allowsNote: false },
    {
      code: "suspectedFraudAbuse",
      label: "Suspected fraud / abuse",
      allowsNote: false,
    },
    {
      code: "customerRequestNoRefund",
      label: "Customer request (no refund)",
      allowsNote: false,
    },
    { code: "businessPolicy", label: "Business policy", allowsNote: false },
    OTHER_REASON,
  ],
  [OPERATIONAL_REASON_ACTS.DAILY_REOPEN]: [
    {
      code: "paymentCorrection",
      label: "Payment correction",
      allowsNote: false,
    },
    {
      code: "billOrderCorrection",
      label: "Bill / order correction",
      allowsNote: false,
    },
    { code: "refundAfterClose", label: "Refund after close", allowsNote: false },
    { code: "reportingError", label: "Reporting error", allowsNote: false },
    OTHER_REASON,
  ],
};

export type OperationalReasonResolution =
  | { success: true; code: string; note?: string }
  | { success: false; error: string };

function cleanNote(note: string | null | undefined): string | undefined {
  if (typeof note !== "string") return undefined;
  const trimmed = note.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * The one place catalogue membership, retirement, and note rules are decided.
 * The catalogue map is injectable so tests can prove retirement without a
 * product code being retired; callers use the default.
 */
export function resolveOperationalReason(
  act: string | null | undefined,
  code: string | null | undefined,
  note?: string | null,
  catalogues: OperationalReasonCatalogues = OPERATIONAL_REASON_CATALOGUES,
): OperationalReasonResolution {
  if (typeof act !== "string" || !Object.hasOwn(catalogues, act)) {
    return { success: false, error: "Unknown operational reason act" };
  }

  if (typeof code !== "string" || code.trim() === "") {
    return { success: false, error: "Reason code is required" };
  }

  const catalogue = catalogues[act] ?? [];
  const entry = catalogue.find((candidate) => candidate.code === code);
  if (!entry) {
    return { success: false, error: "Unknown reason code for this act" };
  }

  if (entry.retired === true) {
    return { success: false, error: "Reason code is retired" };
  }

  const cleanedNote = cleanNote(note);
  if (cleanedNote !== undefined && !entry.allowsNote) {
    return {
      success: false,
      error: "A note is only allowed with the Other reason code",
    };
  }

  return cleanedNote === undefined
    ? { success: true, code: entry.code }
    : { success: true, code: entry.code, note: cleanedNote };
}

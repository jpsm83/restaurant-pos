import { describe, expect, it } from "vitest";

import {
  OPERATIONAL_REASON_ACTS,
  OPERATIONAL_REASON_CATALOGUES,
  resolveOperationalReason,
  type OperationalReasonCatalogues,
} from "restaurant-pos-packages/operationalReasons";

const EXPECTED_ACTS = [
  "void",
  "invitation",
  "manualDiscount",
  "refund",
  "countReedit",
  "giftCardVoid",
  "dailyReopen",
] as const;

const EXPECTED_CODES: Record<(typeof EXPECTED_ACTS)[number], string[]> = {
  void: [
    "wrongItem",
    "customerChangedMind",
    "kitchenPrepError",
    "outOfStock",
    "duplicateEntry",
    "trainingTest",
    "other",
  ],
  invitation: [
    "guestRecovery",
    "staffEmployeeMeal",
    "ownerManagerDiscretion",
    "vipMarketing",
    "supplierPartner",
    "other",
  ],
  manualDiscount: [
    "guestRecovery",
    "priceMatchMissingPromotion",
    "managerDiscretion",
    "serviceRecovery",
    "other",
  ],
  refund: [
    "customerDissatisfaction",
    "wrongOrderOrCharge",
    "itemUnavailableAfterPayment",
    "duplicateCharge",
    "cancelledAfterPayment",
    "other",
  ],
  countReedit: [
    "miscount",
    "wrongUnit",
    "wrongItem",
    "goodsArrivedAfterCount",
    "entryError",
    "other",
  ],
  giftCardVoid: [
    "issuedInError",
    "suspectedFraudAbuse",
    "customerRequestNoRefund",
    "businessPolicy",
    "other",
  ],
  dailyReopen: [
    "paymentCorrection",
    "billOrderCorrection",
    "refundAfterClose",
    "reportingError",
    "other",
  ],
};

describe("operational reason catalogues", () => {
  it("exports exactly the seven closed act keys", () => {
    expect(Object.values(OPERATIONAL_REASON_ACTS)).toEqual(EXPECTED_ACTS);
    expect(Object.keys(OPERATIONAL_REASON_CATALOGUES).sort()).toEqual(
      [...EXPECTED_ACTS].sort(),
    );
  });

  it("authors the product codes for every act", () => {
    for (const act of EXPECTED_ACTS) {
      expect(
        OPERATIONAL_REASON_CATALOGUES[act].map((entry) => entry.code),
        `${act} codes`,
      ).toEqual(EXPECTED_CODES[act]);
    }
  });

  it("gives every catalogue exactly one Other entry that alone allows a note", () => {
    for (const act of EXPECTED_ACTS) {
      const catalogue = OPERATIONAL_REASON_CATALOGUES[act];

      expect(catalogue.length, `${act} is not empty`).toBeGreaterThan(0);

      const otherEntries = catalogue.filter((entry) => entry.code === "other");
      expect(otherEntries, `${act} has one Other`).toHaveLength(1);
      expect(otherEntries[0].allowsNote).toBe(true);

      for (const entry of catalogue) {
        expect(entry.allowsNote, `${act}.${entry.code} note marker`).toBe(
          entry.code === "other",
        );
        expect(entry.label.trim(), `${act}.${entry.code} label`).not.toBe("");
        expect(entry.retired ?? false).toBe(false);
      }
    }
  });

  it("keeps codes unique inside every catalogue", () => {
    for (const act of EXPECTED_ACTS) {
      const codes = OPERATIONAL_REASON_CATALOGUES[act].map(
        (entry) => entry.code,
      );
      expect(new Set(codes).size, `${act} codes are unique`).toBe(codes.length);
    }
  });

  it("resolves a named code without a note", () => {
    expect(resolveOperationalReason("void", "wrongItem")).toEqual({
      success: true,
      code: "wrongItem",
    });
  });

  it("resolves Other with a cleaned optional note", () => {
    expect(
      resolveOperationalReason("void", "other", "  Guest left before service  "),
    ).toEqual({
      success: true,
      code: "other",
      note: "Guest left before service",
    });
  });

  it("treats a blank Other note as absent", () => {
    expect(resolveOperationalReason("void", "other", "   ")).toEqual({
      success: true,
      code: "other",
    });
  });

  it("treats a blank note as absent for a named reason", () => {
    expect(resolveOperationalReason("void", "wrongItem", "   ")).toEqual({
      success: true,
      code: "wrongItem",
    });
  });

  it("rejects an unknown act", () => {
    expect(resolveOperationalReason("cancellation", "other").success).toBe(
      false,
    );
  });

  it("rejects a missing code", () => {
    expect(resolveOperationalReason("void", undefined).success).toBe(false);
    expect(resolveOperationalReason("void", "").success).toBe(false);
  });

  it("rejects a code from another act's catalogue", () => {
    expect(resolveOperationalReason("void", "guestRecovery").success).toBe(
      false,
    );
  });

  it("rejects an unknown code", () => {
    expect(resolveOperationalReason("void", "notAReason").success).toBe(false);
  });

  it("rejects a note supplied with a named reason", () => {
    expect(
      resolveOperationalReason("void", "wrongItem", "Kitchen rang it twice")
        .success,
    ).toBe(false);
  });

  it("rejects a retired code using a synthetic fixture", () => {
    const retiredFixture: OperationalReasonCatalogues = {
      ...OPERATIONAL_REASON_CATALOGUES,
      void: [
        ...OPERATIONAL_REASON_CATALOGUES.void,
        {
          code: "retiredVoidReason",
          label: "Retired void reason",
          retired: true,
          allowsNote: false,
        },
      ],
    };

    expect(
      resolveOperationalReason(
        "void",
        "retiredVoidReason",
        undefined,
        retiredFixture,
      ).success,
    ).toBe(false);
  });
});

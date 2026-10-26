import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  reasonCode,
  reasonNote,
} from "restaurant-pos-packages/schemas";

describe("reasonCode", () => {
  it("sanitizes the selected code", () => {
    expect(reasonCode.parse("  <b>wrong</b>   item\u0000 ")).toBe("wrong item");
  });

  it("rejects a missing or blank code", () => {
    expect(reasonCode.safeParse(undefined).success).toBe(false);
    expect(reasonCode.safeParse("").success).toBe(false);
    expect(reasonCode.safeParse("   ").success).toBe(false);
  });
});

describe("reasonNote", () => {
  it("is absent when omitted", () => {
    expect(reasonNote.parse(undefined)).toBeUndefined();
  });

  it("is absent when blank before or after sanitization", () => {
    expect(reasonNote.parse("")).toBeUndefined();
    expect(reasonNote.parse("   \t ")).toBeUndefined();
    expect(reasonNote.parse("<b></b>")).toBeUndefined();
    expect(reasonNote.parse("\u0000\u0007")).toBeUndefined();
  });

  it("sanitizes free text while preserving line breaks", () => {
    expect(reasonNote.parse("  <b>Guest</b> left\n\n\nearly  ")).toBe(
      "Guest left\n\nearly",
    );
  });

  it("accepts 280 characters and rejects 281", () => {
    expect(reasonNote.parse("a".repeat(280))).toBe("a".repeat(280));
    expect(reasonNote.safeParse("a".repeat(281)).success).toBe(false);
  });
});

describe("reason request fields", () => {
  const reasonFields = z.strictObject({ reasonCode, reasonNote });

  it("accepts a code with an optional note", () => {
    expect(
      reasonFields.parse({
        reasonCode: "other",
        reasonNote: "Guest walked out",
      }),
    ).toEqual({ reasonCode: "other", reasonNote: "Guest walked out" });
  });

  it("rejects an unknown key", () => {
    expect(
      reasonFields.safeParse({
        reasonCode: "other",
        reasonNote: "Guest walked out",
        freeTextReason: "legacy",
      }).success,
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  getDateFnsLocale,
  resolveFormattingLanguage,
} from "../format";

const sampleDateTime = new Date(2026, 2, 27, 10, 15, 42);

describe("locale-aware formatting", () => {
  it("formats calendar dates for English and Spanish", () => {
    expect(formatDate("2026-03-27", "en")).toBe("03/27/2026");
    expect(formatDate("2026-03-27", "es")).toBe("27/03/2026");
    expect(formatDate(sampleDateTime, "en")).toBe("03/27/2026");
    expect(formatDate(sampleDateTime, "es")).toBe("27/03/2026");
  });

  it("formats date-times for English and Spanish", () => {
    expect(formatDateTime(sampleDateTime, "en")).toBe("03/27/2026, 10:15 AM");
    expect(formatDateTime(sampleDateTime, "es")).toBe("27/03/2026, 10:15");
  });

  it("formats numbers with the active language separators", () => {
    expect(formatNumber(1234567.89, "en")).toBe("1,234,567.89");
    expect(formatNumber(1234567.89, "es")).toBe("1.234.567,89");
  });

  it("formats money with an explicit Business currency", () => {
    expect(formatCurrency(1234.5, "USD", "en")).toBe("$1,234.50");
    expect(formatCurrency(1234.5, "EUR", "es")).toBe("1234,50\u00a0€");
  });

  it("never changes the currency code or amount from the UI language", () => {
    expect(formatCurrency(1234.5, "USD", "es")).toContain("US$");
    expect(formatCurrency(1234.5, "USD", "es")).toContain("1234,50");
    expect(formatCurrency(1234.5, "USD", "en")).toContain("$");
    expect(formatCurrency(1234.5, "USD", "en")).toContain("1,234.50");
  });

  it("falls back to plain numbers when the Business currency is missing", () => {
    expect(formatCurrency(1234.5, null, "en")).toBe("1,234.5");
    expect(formatCurrency(1234.5, undefined, "es")).toBe("1234,5");
    expect(formatCurrency(1234.5, "  ", "en")).toBe("1,234.5");
  });

  it("maps the active language to date-fns locale data", () => {
    expect(getDateFnsLocale("en").code).toBe("en-US");
    expect(getDateFnsLocale("es").code).toBe("es");
  });

  it("normalizes i18next language tags to a supported display language", () => {
    expect(resolveFormattingLanguage("es-MX")).toBe("es");
    expect(resolveFormattingLanguage("en-US")).toBe("en");
    expect(resolveFormattingLanguage("fr")).toBe("en");
    expect(resolveFormattingLanguage(undefined)).toBe("en");
  });

  it("returns the input when a value is not a valid date", () => {
    expect(formatDate("not-a-date", "en")).toBe("not-a-date");
    expect(formatDateTime("not-a-date", "es")).toBe("not-a-date");
  });
});

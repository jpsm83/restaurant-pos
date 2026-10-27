import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createTestI18n, renderWithI18n } from "@/test/i18nTestUtils";
import { useFormatting } from "../useFormatting";

function FormattingProbe() {
  const { formatDate, formatNumber, formatCurrency, dateFnsLocale } =
    useFormatting();

  return (
    <div data-testid="probe">
      {[
        formatDate("2026-03-27"),
        formatNumber(12345.5),
        formatCurrency(12345.5, null),
        dateFnsLocale.code,
      ].join("|")}
    </div>
  );
}

describe("useFormatting", () => {
  it("re-renders formatted output when the active language changes", async () => {
    const i18n = await createTestI18n("en");
    await renderWithI18n(<FormattingProbe />, { i18n });

    expect(screen.getByTestId("probe").textContent).toBe(
      "03/27/2026|12,345.5|12,345.5|en-US",
    );

    await act(async () => {
      await i18n.changeLanguage("es");
    });

    expect(screen.getByTestId("probe").textContent).toBe(
      "27/03/2026|12.345,5|12.345,5|es",
    );
  });
});

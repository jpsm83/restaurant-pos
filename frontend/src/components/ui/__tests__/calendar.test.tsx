import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Calendar } from "@/components/ui/calendar";
import { getDateFnsLocale } from "@/lib/formatting";
import { renderWithI18n } from "@/test/i18nTestUtils";

describe("ui/calendar", () => {
  it("renders and allows day selection", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    await renderWithI18n(
      <Calendar
        mode="single"
        month={new Date(2026, 2, 1)}
        selected={undefined}
        onSelect={onSelect}
      />
    );

    expect(screen.getByRole("grid")).toBeInTheDocument();

    const firstDayButton = document.querySelector(
      "button[data-day]"
    ) as HTMLButtonElement | null;
    expect(firstDayButton).not.toBeNull();
    if (!firstDayButton) return;

    firstDayButton.focus();
    expect(firstDayButton).toHaveFocus();
    await user.click(firstDayButton);

    expect(onSelect).toHaveBeenCalled();
  });

  it("uses the date-fns locale supplied by its consuming screen", async () => {
    await renderWithI18n(
      <Calendar
        mode="single"
        month={new Date(2026, 2, 1)}
        locale={getDateFnsLocale("es")}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "domingo, 1 de marzo de 2026",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Sunday, March 1/ }),
    ).not.toBeInTheDocument();
  });
});

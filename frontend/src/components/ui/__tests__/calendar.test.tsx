import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Calendar } from "@/components/ui/calendar";
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
});

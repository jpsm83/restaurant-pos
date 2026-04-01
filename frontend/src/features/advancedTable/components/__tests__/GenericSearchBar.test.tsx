import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import GenericSearchBar from "@/features/advancedTable/components/GenericSearchBar";
import { renderWithI18n } from "@/test/i18nTestUtils";

describe("GenericSearchBar", () => {
  it("reads initial date range from props and updates rendered state on rerender", async () => {
    const onDateChange = vi.fn();
    const firstStart = "2026-03-27T08:00:00";
    const firstEnd = "2026-03-27T09:00:00";
    const { rerender } = await renderWithI18n(
      <GenericSearchBar
        startDate={firstStart}
        endDate={firstEnd}
        onDateChange={onDateChange}
      />
    );

    const summaryLabel = document.querySelector("label");
    expect(summaryLabel).toBeInTheDocument();
    expect(summaryLabel).toHaveTextContent(/last hour|from/i);

    const nextStart = "2026-03-27T09:15:42";
    const nextEnd = "2026-03-27T11:15:42";
    rerender(
      <GenericSearchBar
        startDate={nextStart}
        endDate={nextEnd}
        onDateChange={onDateChange}
      />
    );

    const dateDisplay = document.querySelector("label");
    expect(dateDisplay).toBeInTheDocument();
    expect(dateDisplay).toHaveTextContent("09:15:42");
    expect(dateDisplay).toHaveTextContent("11:15:42");
  });

  it("calls onDateChange when applying custom date range", async () => {
    const user = userEvent.setup();
    const onDateChange = vi.fn();
    await renderWithI18n(
      <GenericSearchBar
        startDate="2026-03-27T08:00:00"
        endDate="2026-03-27T09:00:00"
        onDateChange={onDateChange}
      />
    );

    const filterButton = screen.getByRole("button", { name: /filter by date/i });
    await user.click(filterButton);

    const timeInputs = Array.from(
      document.querySelectorAll('input[type="time"]')
    ) as HTMLInputElement[];
    expect(timeInputs.length).toBeGreaterThanOrEqual(2);
    await user.clear(timeInputs[0] as HTMLInputElement);
    await user.type(timeInputs[0] as HTMLInputElement, "07:00:00");
    await user.clear(timeInputs[1] as HTMLInputElement);
    await user.type(timeInputs[1] as HTMLInputElement, "08:30:00");
    await user.click(screen.getByRole("button", { name: "Apply date range" }));

    expect(onDateChange).toHaveBeenCalledTimes(1);
    const [startArg, endArg] = onDateChange.mock.calls[0] as [string, string];
    expect(startArg).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    expect(endArg).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  it("keeps children and action buttons working while date props change", async () => {
    const user = userEvent.setup();
    const onDateChange = vi.fn();
    const onExport = vi.fn(async () => undefined);
    const { rerender } = await renderWithI18n(
      <GenericSearchBar
        startDate="2026-03-27T08:00:00"
        endDate="2026-03-27T09:00:00"
        onDateChange={onDateChange}
        onExport={onExport}
      >
        <button type="button">Child field</button>
      </GenericSearchBar>
    );

    expect(screen.getByRole("button", { name: "Child field" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /export all/i }));
    expect(onExport).toHaveBeenCalledTimes(1);

    rerender(
      <GenericSearchBar
        startDate="2026-03-27T09:00:00"
        endDate="2026-03-27T10:00:00"
        onDateChange={onDateChange}
        onExport={onExport}
      >
        <button type="button">Child field</button>
      </GenericSearchBar>
    );

    expect(screen.getByRole("button", { name: "Child field" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export all/i })).toBeInTheDocument();
  });

  it("opens and closes date popover, including outside click", async () => {
    const user = userEvent.setup();
    await renderWithI18n(
      <GenericSearchBar
        startDate="2026-03-27T08:00:00"
        endDate="2026-03-27T09:00:00"
        onDateChange={vi.fn()}
      />,
    );

    const filterButton = screen.getByRole("button", { name: /filter by date/i });
    await user.click(filterButton);
    expect(screen.getByText(/quick date range/i)).toBeInTheDocument();

    await user.click(document.body);
    expect(screen.queryByText(/quick date range/i)).not.toBeInTheDocument();
  });

  it("supports keyboard flow for date popover controls", async () => {
    const user = userEvent.setup();
    await renderWithI18n(
      <GenericSearchBar
        startDate="2026-03-27T08:00:00"
        endDate="2026-03-27T09:00:00"
        onDateChange={vi.fn()}
      />,
    );

    await user.tab();
    const filterButton = screen.getByRole("button", { name: /filter by date/i });
    expect(filterButton).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByText(/quick date range/i)).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByText(/quick date range/i)).not.toBeInTheDocument();
  });

  it("keeps config and export controls stable in toolbar layout", async () => {
    const user = userEvent.setup();
    const onConfigClick = vi.fn();
    const onExport = vi.fn(async () => undefined);

    await renderWithI18n(
      <GenericSearchBar
        startDate="2026-03-27T08:00:00"
        endDate="2026-03-27T09:00:00"
        onDateChange={vi.fn()}
        onConfigClick={onConfigClick}
        showConfigButton
        onExport={onExport}
      />,
    );

    const filtersRow = document.querySelector("div.flex.justify-center.items-center.gap-2.flex-wrap");
    expect(filtersRow).toBeInTheDocument();

    const settingsIcon = document.querySelector("svg.lucide-settings");
    const configButton = settingsIcon?.closest("button") as HTMLButtonElement | null;
    expect(configButton).toBeInTheDocument();
    if (!configButton) return;
    await user.click(configButton);
    await user.click(screen.getByRole("button", { name: /export all/i }));
    expect(onConfigClick).toHaveBeenCalledTimes(1);
    expect(onExport).toHaveBeenCalledTimes(1);
  });
});

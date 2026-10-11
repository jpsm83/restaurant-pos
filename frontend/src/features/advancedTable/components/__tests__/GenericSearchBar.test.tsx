import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import GenericSearchBar from "@/features/advancedTable/components/GenericSearchBar";
import { renderWithI18n } from "@/test/i18nTestUtils";

describe("GenericSearchBar", () => {
  it("shows a date-only summary and updates it on rerender", async () => {
    const onDateChange = vi.fn();
    const { rerender } = await renderWithI18n(
      <GenericSearchBar
        startDate="2026-03-10"
        endDate="2026-03-20"
        onDateChange={onDateChange}
      />
    );

    const summaryLabel = document.querySelector("label");
    expect(summaryLabel).toBeInTheDocument();
    expect(summaryLabel).toHaveTextContent(/from/i);
    expect(summaryLabel).toHaveTextContent(/until/i);
    expect(summaryLabel?.textContent ?? "").not.toMatch(/\d{1,2}:\d{2}:\d{2}/);

    rerender(
      <GenericSearchBar
        startDate="2026-04-05"
        endDate="2026-04-15"
        onDateChange={onDateChange}
      />
    );

    const dateDisplay = document.querySelector("label");
    expect(dateDisplay).toBeInTheDocument();
    expect(dateDisplay).toHaveTextContent(/from/i);
  });

  it("emits date-only values when selecting a quick range", async () => {
    const user = userEvent.setup();
    const onDateChange = vi.fn();
    await renderWithI18n(
      <GenericSearchBar
        startDate="2026-03-10"
        endDate="2026-03-20"
        onDateChange={onDateChange}
      />
    );

    await user.click(screen.getByRole("button", { name: /filter by date/i }));
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: /today/i }));

    expect(onDateChange).toHaveBeenCalledTimes(1);
    const [startArg, endArg] = onDateChange.mock.calls[0] as [string, string];
    expect(startArg).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(endArg).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }, 15000);

  it("emits date-only values when applying a custom date range", async () => {
    const user = userEvent.setup();
    const onDateChange = vi.fn();
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    const month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    const startIso = `${month}-10`;
    const endIso = `${month}-20`;

    await renderWithI18n(
      <GenericSearchBar
        startDate={`${month}-02`}
        endDate={`${month}-04`}
        onDateChange={onDateChange}
      />
    );

    await user.click(screen.getByRole("button", { name: /filter by date/i }));
    expect(document.querySelectorAll('input[type="time"]')).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: /start date/i }));
    const startDay = document.querySelector(
      `td[data-day="${startIso}"] button`,
    ) as HTMLButtonElement | null;
    expect(startDay).not.toBeNull();
    if (!startDay) return;
    await user.click(startDay);

    await user.click(screen.getByRole("button", { name: /end date/i }));
    const endDay = document.querySelector(
      `td[data-day="${endIso}"] button`,
    ) as HTMLButtonElement | null;
    expect(endDay).not.toBeNull();
    if (!endDay) return;
    await user.click(endDay);

    await user.click(screen.getByRole("button", { name: "Apply date range" }));

    expect(onDateChange).toHaveBeenCalledTimes(1);
    const [startArg, endArg] = onDateChange.mock.calls[0] as [string, string];
    expect(startArg).toBe(startIso);
    expect(endArg).toBe(endIso);
  }, 15000);

  it("keeps children and action buttons working while date props change", async () => {
    const user = userEvent.setup();
    const onDateChange = vi.fn();
    const onExport = vi.fn(async () => undefined);
    const { rerender } = await renderWithI18n(
      <GenericSearchBar
        startDate="2026-03-10"
        endDate="2026-03-20"
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
        startDate="2026-03-15"
        endDate="2026-03-25"
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
        startDate="2026-03-10"
        endDate="2026-03-20"
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
        startDate="2026-03-10"
        endDate="2026-03-20"
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
        startDate="2026-03-10"
        endDate="2026-03-20"
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

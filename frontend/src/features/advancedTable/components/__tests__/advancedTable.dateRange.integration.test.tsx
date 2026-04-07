import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { TableColumnConfig } from "@/features/advancedTable/types/tableContracts";
import { StandaloneAdvancedTable } from "@/features/advancedTable/components/StandaloneAdvancedTable";
import BusinessAdvancedTableSection from "@/components/business/BusinessAdvancedTableSection";
import { renderWithI18n } from "@/test/i18nTestUtils";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

async function renderBusinessSection(
  initialUrl = "/business",
  options?: { enableDateToolbarFilter?: boolean },
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  });

  return renderWithI18n(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route
          path="/business"
          element={
            <>
              <LocationProbe />
              <BusinessAdvancedTableSection
                businessId="64b000000000000000000001"
                businessEmail="owner@restaurant.com"
                enableDateToolbarFilter={options?.enableDateToolbarFilter}
              />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
    {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    },
  );
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  });
}

describe("advanced table date range integration", () => {
  async function selectQuickRange(user: ReturnType<typeof userEvent.setup>, label: RegExp) {
    await user.click(screen.getByRole("button", { name: /filter by date/i }));
    const quickRangeCombobox = screen
      .getAllByRole("combobox")
      .find((el) => {
        if (el.getAttribute("data-slot") !== "select-trigger") return false;
        const text = (el.textContent ?? "").toLowerCase();
        return (
          text.includes("last hour") ||
          text.includes("today") ||
          text.includes("this week") ||
          text.includes("this month")
        );
      });
    expect(quickRangeCombobox).toBeTruthy();
    if (!quickRangeCombobox) return;
    await user.click(quickRangeCombobox);
    await user.click(await screen.findByRole("option", { name: label }));
  }

  it("updates URL query params when selecting quick range", async () => {
    const user = userEvent.setup();
    await renderBusinessSection();

    await screen.findByRole("button", { name: /filter by date/i });
    const initialSearch = screen.getByTestId("location-search").textContent ?? "";
    await selectQuickRange(user, /this month/i);

    const updatedSearch = screen.getByTestId("location-search").textContent ?? "";
    expect(updatedSearch).toContain("start-date=");
    expect(updatedSearch).toContain("end-date=");
    expect(updatedSearch).not.toBe(initialSearch);
  });

  it("combines column filter with selected date range", async () => {
    const user = userEvent.setup();
    await renderBusinessSection();
    await screen.findByRole("button", { name: /filter by date/i });
    await selectQuickRange(user, /this month/i);
    const ticketCells = await screen.findAllByText(/T-\d{4}/);
    const firstTicket = ticketCells[0]?.textContent ?? "";
    expect(firstTicket).toMatch(/^T-\d{4}$/);

    const ticketInput = await screen.findByLabelText("Filter ticketNumber");
    await user.clear(ticketInput);
    await user.type(ticketInput, firstTicket);

    expect(await screen.findByText(firstTicket)).toBeInTheDocument();
  });

  it("updates URL query params when applying a custom time range", async () => {
    const user = userEvent.setup();
    await renderBusinessSection();
    await screen.findByRole("button", { name: /filter by date/i });

    const before = screen.getByTestId("location-search").textContent ?? "";
    await user.click(screen.getByRole("button", { name: /filter by date/i }));

    const timeInputs = screen.getAllByDisplayValue(/\d{2}:\d{2}:\d{2}/);
    expect(timeInputs.length).toBeGreaterThanOrEqual(2);
    await user.clear(timeInputs[0]);
    await user.type(timeInputs[0], "00:00:00");
    await user.clear(timeInputs[1]);
    await user.type(timeInputs[1], "23:59:59");
    await user.click(screen.getByRole("button", { name: /apply date range/i }));

    const after = screen.getByTestId("location-search").textContent ?? "";
    expect(after).toContain("start-date=");
    expect(after).toContain("end-date=");
    expect(after).not.toBe(before);
  });

  it("clear filters restores baseline state and keeps URL range params", async () => {
    const user = userEvent.setup();
    await renderBusinessSection();

    const ticketInput = await screen.findByLabelText("Filter ticketNumber");
    await user.type(ticketInput, "T-0001");
    expect((ticketInput as HTMLInputElement).value).toBe("T-0001");

    await user.click(screen.getByRole("button", { name: /clear filters/i }));

    expect((await screen.findByLabelText("Filter ticketNumber") as HTMLInputElement).value).toBe("");
    const search = screen.getByTestId("location-search").textContent ?? "";
    expect(search).toContain("start-date=");
    expect(search).toContain("end-date=");
  });

  it("applies date range filtering in local mode", async () => {
    const queryClient = createTestQueryClient();
    const columns: TableColumnConfig<{ id: string; createdAt: string }>[] = [
      { id: "id", header: "Id", accessorKey: "id", enableColumnFilter: true },
      {
        id: "createdAt",
        header: "Created at",
        accessorKey: "createdAt",
        enableColumnFilter: true,
      },
    ];

    await renderWithI18n(
      <StandaloneAdvancedTable
        data={[
          { id: "row-1", createdAt: "2026-03-01T10:00:00" },
          { id: "row-2", createdAt: "2026-04-01T10:00:00" },
        ]}
        columns={columns}
        dateRangeFilter={{
          startDate: "2026-03-01T00:00:00",
          endDate: "2026-03-31T23:59:59",
          columnId: "createdAt",
        }}
      />,
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      },
    );

    expect(screen.getByText("row-1")).toBeInTheDocument();
    expect(screen.queryByText("row-2")).not.toBeInTheDocument();
  });

  it("uses URL date range to drive fetch-mode result set", async () => {
    await renderBusinessSection(
      "/business?start-date=2099-01-01T00:00:00&end-date=2099-01-01T23:59:59",
    );

    expect(await screen.findByText("No business records available.")).toBeInTheDocument();
  });

  it("keeps legacy table path when date toolbar feature flag is disabled", async () => {
    await renderBusinessSection("/business", { enableDateToolbarFilter: false });

    expect(screen.queryByRole("button", { name: /filter by date/i })).not.toBeInTheDocument();
    const search = screen.getByTestId("location-search").textContent ?? "";
    expect(search).not.toContain("start-date=");
    expect(search).not.toContain("end-date=");
  });
});

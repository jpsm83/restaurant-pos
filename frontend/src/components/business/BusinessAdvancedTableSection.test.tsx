import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { renderWithI18n } from "@/test/i18nTestUtils";
import BusinessAdvancedTableSection from "./BusinessAdvancedTableSection";

vi.mock("@/features/advancedTable/components/StandaloneAdvancedTable", () => ({
  StandaloneAdvancedTable: () => (
    <div data-testid="standalone-table-stub">Advanced table</div>
  ),
}));

function renderSection(
  props: { businessId?: string; businessEmail?: string } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  });
  return renderWithI18n(
    <MemoryRouter initialEntries={["/?start-date=2025-01-01T00:00:00&end-date=2025-01-01T23:59:59"]}>
      <QueryClientProvider client={client}>
        <BusinessAdvancedTableSection
          businessId={props.businessId ?? "64b000000000000000000001"}
          businessEmail={props.businessEmail ?? "owner@restaurant.com"}
          enableDateToolbarFilter={false}
        />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("BusinessAdvancedTableSection", () => {
  it("renders section title and business context", async () => {
    await renderSection();

    expect(
      screen.getByRole("heading", { name: /advanced table integration target/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/business id:\s*64b000000000000000000001/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/business email:\s*owner@restaurant.com/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("standalone-table-stub")).toBeInTheDocument();
  });
});

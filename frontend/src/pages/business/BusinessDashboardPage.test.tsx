import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { renderWithI18n } from "@/test/i18nTestUtils";
import BusinessDashboardPage from "./BusinessDashboardPage";

vi.mock("@/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/auth")>();
  return {
    ...actual,
    useAuth: () => ({
      state: {
        user: {
          id: "507f1f77bcf86cd799439011",
          email: "owner@restaurant.com",
          type: "business" as const,
        },
        status: "authenticated" as const,
        error: null,
      },
    }),
  };
});

function renderBusinessDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: 0 },
    },
  });

  return renderWithI18n(
    <MemoryRouter initialEntries={["/business/64b000000000000000000001/dashboard"]}>
      <Routes>
        <Route path="/business/:businessId/dashboard" element={<BusinessDashboardPage />} />
      </Routes>
    </MemoryRouter>,
    {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    }
  );
}

describe("BusinessDashboardPage advanced table integration", () => {
  it("renders dashboard shell and advanced table section for tenant", async () => {
    await renderBusinessDashboard();

    expect(screen.getByRole("heading", { name: /business dashboard/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /advanced table integration target/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/business id: 64b000000000000000000001/i)).toBeInTheDocument();
    expect(screen.getByText(/business email: owner@restaurant.com/i)).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.queryByText(/loading table data/i)).not.toBeInTheDocument();
      },
      { timeout: 10_000 },
    );

    expect(screen.getByRole("columnheader", { name: /ticket/i })).toBeInTheDocument();
  });
});

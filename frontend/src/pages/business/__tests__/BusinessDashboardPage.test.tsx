import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach } from "vitest";
import { formatCalendarDate } from "@/lib/calendarDate";
import { renderWithI18n } from "@/test/i18nTestUtils";
import BusinessDashboardPage from "../BusinessDashboardPage";

const mockUseBusinessProfileQuery = vi.fn();

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => ({
    state: {
      user: {
        id: "507f1f77bcf86cd799439011",
        email: "owner@restaurant.com",
        type: "user" as const,
      },
      status: "authenticated" as const,
      error: null,
    },
  }),
}));

vi.mock("@/services/business/businessService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/business/businessService")>();
  return {
    ...actual,
    useBusinessProfileQuery: (...args: unknown[]) =>
      mockUseBusinessProfileQuery(...args),
  };
});

function renderBusinessDashboard(language?: "en" | "es") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: 0 },
    },
  });
  const startDate = formatCalendarDate(
    new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
  );
  const endDate = formatCalendarDate(
    new Date(Date.now() + 24 * 60 * 60 * 1000),
  );

  return renderWithI18n(
    <MemoryRouter
      initialEntries={[
        `/business/64b000000000000000000001/dashboard?start-date=${startDate}&end-date=${endDate}`,
      ]}
    >
      <Routes>
        <Route path="/business/:businessId/dashboard" element={<BusinessDashboardPage />} />
      </Routes>
    </MemoryRouter>,
    {
      language,
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    },
  );
}

describe("BusinessDashboardPage advanced table integration", () => {
  beforeEach(() => {
    mockUseBusinessProfileQuery.mockReset();
    mockUseBusinessProfileQuery.mockReturnValue({
      data: { currencyTrade: "USD", email: "owner@restaurant.com" },
    });
  });

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
    expect((await screen.findAllByText(/^\$\d+\.\d{2}$/)).length).toBeGreaterThan(0);
    expect(
      (await screen.findAllByText(/^\d{2}\/\d{2}\/\d{4}, \d{1,2}:\d{2}(?:\s?[AP]M)?$/)).length,
    ).toBeGreaterThan(0);
  });

  it("renders the dashboard table statuses, dates, and currency in Spanish", async () => {
    mockUseBusinessProfileQuery.mockReturnValue({
      data: { currencyTrade: "EUR", email: "owner@restaurant.com" },
    });

    await renderBusinessDashboard("es");

    expect(
      screen.getByRole("heading", { name: "Panel de empresa" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Objetivo de integración de tabla avanzada" }),
    ).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.queryByText(/cargando datos de la tabla/i)).not.toBeInTheDocument();
      },
      { timeout: 10_000 },
    );

    expect(screen.getByRole("columnheader", { name: "Creado el" })).toBeInTheDocument();
    expect(
      (await screen.findAllByText(/^(Abierto|En preparación|Pagado)$/)).length,
    ).toBeGreaterThan(0);
    expect((await screen.findAllByText(/€/)).length).toBeGreaterThan(0);
    expect(
      (await screen.findAllByText(/^\d{2}\/\d{2}\/\d{4}, \d{1,2}:\d{2}$/)).length,
    ).toBeGreaterThan(0);
  });
});

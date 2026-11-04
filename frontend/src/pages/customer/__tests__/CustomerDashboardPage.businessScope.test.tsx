import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import CustomerDashboardPage from "../CustomerDashboardPage";

const { mockGet, mockPost, outsideBusinessId } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  outsideBusinessId: "outside-portfolio",
}));

vi.mock("@/services/http", () => ({
  http: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => ({
    state: {
      status: "authenticated",
      user: {
        id: "u1",
        email: "owner@demo.test",
        type: "user",
        role: "Customer",
      },
      error: null,
    },
    dispatch: vi.fn(),
  }),
}));

vi.mock("@/components/customer/PortfolioVenues", () => ({
  PortfolioVenues: ({
    onOpenBusiness,
  }: {
    onOpenBusiness: (businessId: string) => void;
  }) => (
    <button type="button" onClick={() => onOpenBusiness(outsideBusinessId)}>
      Open business
    </button>
  ),
}));

const populatedPortfolio = {
  owner: { _id: "o1", country: "Spain", subscription: "Free" },
  country: "Spain",
  subscription: "Free",
  companies: [
    {
      _id: "c1",
      country: "Spain",
      legalName: "Demo Bistro SL",
      taxNumber: "B12345678",
      businesses: [
        {
          _id: "b1",
          tradeName: "Demo Bistro",
          currencyTrade: "EUR",
          companyId: "c1",
          profileComplete: false,
          address: { country: "Spain" },
        },
      ],
    },
  ],
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: 0 },
    },
  });
  return renderWithI18n(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <LocationProbe />
        <Routes>
          <Route path="/dashboard" element={<CustomerDashboardPage />} />
          <Route
            path="/business/:businessId/dashboard"
            element={<div>Business dashboard</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CustomerDashboardPage portfolio scope", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it("does not switch mode or navigate for a Business id absent from the portfolio", async () => {
    mockGet.mockResolvedValue({ data: populatedPortfolio });
    const user = userEvent.setup();

    await renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Open business" }),
    );

    expect(mockPost).not.toHaveBeenCalled();
    expect(screen.getByTestId("location").textContent).toBe("/dashboard");
    expect(screen.queryByText("Business dashboard")).not.toBeInTheDocument();
  });
});

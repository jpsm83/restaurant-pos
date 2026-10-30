import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import CustomerDashboardPage from "../CustomerDashboardPage";

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
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

const emptyPortfolio = {
  owner: null,
  country: null,
  subscription: null,
  companies: [],
};

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

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: 0 },
    },
  });
  return renderWithI18n(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/u1/customer/dashboard"]}>
        <Routes>
          <Route
            path="/:userId/customer/dashboard"
            element={<CustomerDashboardPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CustomerDashboardPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it("shows Add your venue when the portfolio is empty", async () => {
    mockGet.mockResolvedValue({ data: emptyPortfolio });

    await renderPage();

    expect(
      await screen.findByRole("button", { name: "Add your venue" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Demo Bistro")).not.toBeInTheDocument();
  });

  it("submits the first venue form and shows the venue after the portfolio refetch", async () => {
    mockGet
      .mockResolvedValueOnce({ data: emptyPortfolio })
      .mockResolvedValue({ data: populatedPortfolio });
    mockPost.mockResolvedValue({
      data: {
        business: {
          _id: "b1",
          tradeName: "Demo Bistro",
          currencyTrade: "USD",
          companyId: "c1",
        },
        company: { _id: "c1", country: "Spain" },
      },
    });
    const user = userEvent.setup();
    await renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Add your venue" }),
    );
    await user.type(screen.getByLabelText("Trade name"), "Demo Bistro");
    await user.type(screen.getByLabelText("Country"), "Spain");
    await user.type(screen.getByLabelText("Company legal name"), "Demo Bistro SL");
    await user.type(screen.getByLabelText("Company tax number"), "B12345678");
    await user.click(screen.getByRole("button", { name: "Create venue" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/api/v1/business", {
        tradeName: "Demo Bistro",
        country: "Spain",
        currencyTrade: "USD",
        company: {
          legalName: "Demo Bistro SL",
          taxNumber: "B12345678",
        },
      });
    });
    expect(await screen.findByText("Demo Bistro")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add your venue" }),
    ).not.toBeInTheDocument();
  });

  it("lists the venues in a populated portfolio", async () => {
    mockGet.mockResolvedValue({ data: populatedPortfolio });

    await renderPage();

    expect(await screen.findByText("Your venues")).toBeInTheDocument();
    expect(screen.getByText("Demo Bistro SL")).toBeInTheDocument();
    expect(screen.getByText("Demo Bistro")).toBeInTheDocument();
    expect(screen.getByText("Spain · EUR")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add your venue" }),
    ).not.toBeInTheDocument();
  });
});

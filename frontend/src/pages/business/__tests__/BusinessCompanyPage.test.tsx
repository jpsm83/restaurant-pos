import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import BusinessCompanyPage from "../BusinessCompanyPage";

const { mockGet, mockPatch, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPatch: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock("@/services/http", () => ({
  http: {
    get: (...args: unknown[]) => mockGet(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
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
  }),
}));

const portfolio = {
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
        {
          _id: "b2",
          tradeName: "Corner Cafe",
          currencyTrade: "EUR",
          companyId: "c1",
          profileComplete: false,
          address: { country: "Spain" },
        },
      ],
    },
  ],
};

const emptyPortfolio = {
  owner: null,
  country: null,
  subscription: null,
  companies: [],
};

function renderPage(language?: "en" | "es") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: 0 },
    },
  });
  return renderWithI18n(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/business/b1/company"]}>
        <Routes>
          <Route
            path="/business/:businessId/company"
            element={<BusinessCompanyPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
    { language },
  );
}

describe("BusinessCompanyPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPatch.mockReset();
    mockPost.mockReset();
  });

  it("shows the Company identity and its venues", async () => {
    mockGet.mockResolvedValue({ data: portfolio });

    await renderPage();

    expect(await screen.findByDisplayValue("Demo Bistro SL")).toBeInTheDocument();
    expect(screen.getByDisplayValue("B12345678")).toBeInTheDocument();
    expect(screen.getByText("Demo Bistro")).toBeInTheDocument();
    expect(screen.getByText("Corner Cafe")).toBeInTheDocument();
  });

  it("saves edited legal name and tax number through the owner Company route", async () => {
    mockGet.mockResolvedValue({ data: portfolio });
    mockPatch.mockResolvedValue({
      data: {
        _id: "c1",
        country: "Spain",
        legalName: "Updated Demo SL",
        taxNumber: "B99999999",
      },
    });
    const user = userEvent.setup();

    await renderPage();

    const legalName = await screen.findByLabelText("Company legal name");
    await user.clear(legalName);
    await user.type(legalName, "Updated Demo SL");
    const taxNumber = screen.getByLabelText("Company tax number");
    await user.clear(taxNumber);
    await user.type(taxNumber, "B99999999");
    await user.click(screen.getByRole("button", { name: "Save company" }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith("/api/v1/owners/companies/c1", {
        legalName: "Updated Demo SL",
        taxNumber: "B99999999",
      });
    });
    expect(await screen.findByText("Company saved.")).toBeInTheDocument();
  });

  it("shows the active venue's Company when the Owner has several", async () => {
    mockGet.mockResolvedValue({
      data: {
        ...portfolio,
        companies: [
          portfolio.companies[0],
          {
            _id: "c2",
            country: "Spain",
            legalName: "Second Taxpayer SL",
            taxNumber: "B87654321",
            businesses: [
              {
                _id: "b9",
                tradeName: "Other Venue",
                currencyTrade: "EUR",
                companyId: "c2",
                profileComplete: false,
                address: { country: "Spain" },
              },
            ],
          },
        ],
      },
    });

    await renderPage();

    expect(await screen.findByDisplayValue("Demo Bistro SL")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Second Taxpayer SL")).not.toBeInTheDocument();
    expect(screen.getByText("Demo Bistro")).toBeInTheDocument();
    expect(screen.queryByText("Other Venue")).not.toBeInTheDocument();
  });

  it("renders its interpolated copy in Spanish", async () => {
    mockGet.mockResolvedValue({ data: portfolio });

    await renderPage("es");

    expect(await screen.findByRole("heading", { name: "Empresa" })).toBeInTheDocument();
    expect(screen.getByText("Locales de esta empresa")).toBeInTheDocument();
    expect(screen.getAllByText("Spain · EUR")).toHaveLength(2);
  });

  it("preselects this Company when adding a venue", async () => {
    mockGet.mockResolvedValue({ data: portfolio });
    mockPost.mockResolvedValue({
      data: {
        business: {
          _id: "b3",
          tradeName: "New Venue",
          currencyTrade: "USD",
          companyId: "c1",
        },
        company: {
          _id: "c1",
          country: "Spain",
          legalName: "Demo Bistro SL",
          taxNumber: "B12345678",
        },
      },
    });
    const user = userEvent.setup();

    await renderPage();

    await user.click(await screen.findByRole("button", { name: "Add venue" }));
    await user.type(screen.getByLabelText("Trade name"), "New Venue");
    await user.click(screen.getByRole("button", { name: "Create venue" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/api/v1/business",
        expect.objectContaining({ companyId: "c1", tradeName: "New Venue" }),
      );
    });
    expect(mockPost.mock.calls[0][1]).not.toHaveProperty("company");
  });

  it("shows no Company data to a User without the owning Owner", async () => {
    mockGet.mockResolvedValue({ data: emptyPortfolio });

    await renderPage();

    expect(await screen.findByText("Company unavailable")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Demo Bistro SL")).not.toBeInTheDocument();
    expect(screen.queryByText("Demo Bistro")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save company" }),
    ).not.toBeInTheDocument();
  });
});

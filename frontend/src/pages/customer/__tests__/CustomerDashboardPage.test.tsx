import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import type { SupportedLanguage } from "@/i18n/config";
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

const incompleteWarning =
  "This venue must be completed before it can go live.";
const completeProfileLink = "Complete venue profile";
const completeAddressLink = "Complete venue address";
const completeCompanyLink = "Complete Company details";

const emptyPortfolio = {
  owner: null,
  country: null,
  subscription: null,
  companies: [],
};

const ownerOnlyPortfolio = {
  owner: { _id: "o1", country: "Spain", subscription: "Free" },
  country: "Spain",
  subscription: "Free",
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

const blankIdentityPortfolio = {
  owner: { _id: "o1", country: "Spain", subscription: "Free" },
  country: "Spain",
  subscription: "Free",
  companies: [
    {
      _id: "c1",
      country: "Spain",
      businesses: [
        {
          _id: "b1",
          tradeName: "Demo Bistro",
          currencyTrade: "USD",
          companyId: "c1",
          profileComplete: false,
          address: { country: "Spain" },
        },
      ],
    },
  ],
};

const completePortfolio = {
  ...populatedPortfolio,
  companies: [
    {
      ...populatedPortfolio.companies[0],
      businesses: [
        {
          ...populatedPortfolio.companies[0].businesses[0],
          profileComplete: true,
          address: {
            country: "Spain",
            state: "Madrid",
            city: "Madrid",
            street: "Gran Via",
            buildingNumber: "1",
            postCode: "28013",
          },
        },
      ],
    },
  ],
};

const mixedPortfolio = {
  ...populatedPortfolio,
  companies: [
    {
      ...populatedPortfolio.companies[0],
      businesses: [
        populatedPortfolio.companies[0].businesses[0],
        {
          ...completePortfolio.companies[0].businesses[0],
          _id: "b2",
          tradeName: "Complete Bistro",
        },
      ],
    },
  ],
};

const multiCompanyPortfolio = {
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
    {
      _id: "c2",
      country: "Spain",
      legalName: "Second Taxpayer SL",
      taxNumber: "B87654321",
      businesses: [
        {
          _id: "b2",
          tradeName: "Corner Cafe",
          currencyTrade: "EUR",
          companyId: "c2",
          profileComplete: false,
          address: { country: "Spain" },
        },
      ],
    },
    {
      _id: "c3",
      country: "Spain",
      businesses: [
        {
          _id: "b4",
          tradeName: "Third Venue",
          currencyTrade: "EUR",
          companyId: "c3",
          profileComplete: false,
          address: { country: "Spain" },
        },
      ],
    },
  ],
};

const joinedPortfolio = {
  ...multiCompanyPortfolio,
  companies: [
    multiCompanyPortfolio.companies[0],
    {
      ...multiCompanyPortfolio.companies[1],
      businesses: [
        ...multiCompanyPortfolio.companies[1].businesses,
        {
          _id: "b3",
          tradeName: "New Cafe",
          currencyTrade: "USD",
          companyId: "c2",
          profileComplete: false,
          address: { country: "Spain" },
        },
      ],
    },
  ],
};

function renderPage(language: SupportedLanguage = "en") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: 0 },
    },
  });
  return renderWithI18n(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={<CustomerDashboardPage />}
          />
          <Route
            path="/business/:businessId/dashboard"
            element={<div>Business dashboard</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
    { language },
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
    expect(screen.queryByText(incompleteWarning)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: completeProfileLink }),
    ).not.toBeInTheDocument();
  });

  it("shows Add your venue when the Owner exists but owns no Companies", async () => {
    mockGet.mockResolvedValue({ data: ownerOnlyPortfolio });

    await renderPage();

    expect(
      await screen.findByRole("button", { name: "Add your venue" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Your venues")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open business" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(incompleteWarning)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: completeProfileLink }),
    ).not.toBeInTheDocument();
  });

  it("shows the loading state without flashing the empty state while the portfolio read is pending", async () => {
    mockGet.mockReturnValue(new Promise(() => {}));

    await renderPage();

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add your venue" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("No venues yet")).not.toBeInTheDocument();
  });

  it("shows localized failure copy when the portfolio read fails", async () => {
    mockGet.mockRejectedValue(new Error("network unavailable"));

    await renderPage();

    expect(
      await screen.findByText(
        "We could not reach the server. Check your connection and try again.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add your venue" }),
    ).not.toBeInTheDocument();
  });

  it("re-reads the portfolio from the retry action and shows the recovered dashboard", async () => {
    mockGet
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValue({ data: populatedPortfolio });
    const user = userEvent.setup();

    await renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Try again" }),
    );

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText("Demo Bistro")).toBeInTheDocument();
    expect(screen.getByText("Your venues")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
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
      expect(mockPost).toHaveBeenCalledWith(
        "/api/v1/business",
        {
          tradeName: "Demo Bistro",
          country: "Spain",
          currencyTrade: "USD",
          company: {
            legalName: "Demo Bistro SL",
            taxNumber: "B12345678",
          },
        },
        expect.anything(),
      );
    });
    expect(await screen.findByText("Demo Bistro")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add your venue" }),
    ).not.toBeInTheDocument();
  });

  it("submits the first venue with a blank Company identity and omits the blank fields", async () => {
    mockGet
      .mockResolvedValueOnce({ data: emptyPortfolio })
      .mockResolvedValue({ data: blankIdentityPortfolio });
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
    await user.click(screen.getByRole("button", { name: "Create venue" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/api/v1/business",
        {
          tradeName: "Demo Bistro",
          country: "Spain",
          currencyTrade: "USD",
          company: {},
        },
        expect.anything(),
      );
    });
    expect(await screen.findByText("Demo Bistro")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add your venue" }),
    ).not.toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalledWith(
      "/api/v1/auth/set-mode",
      expect.anything(),
    );
  });

  it("opens an owned venue in business mode and navigates to its Business dashboard", async () => {
    mockGet.mockResolvedValue({ data: populatedPortfolio });
    mockPost.mockResolvedValue({
      data: { message: "Auth mode set successfully", mode: "business" },
    });
    const user = userEvent.setup();

    await renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Open business" }),
    );

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/api/v1/auth/set-mode", {
        mode: "business",
      });
    });
    expect(await screen.findByText("Business dashboard")).toBeInTheDocument();
  });

  it("offers Open business from each portfolio venue and nowhere else", async () => {
    mockGet.mockResolvedValue({ data: multiCompanyPortfolio });

    await renderPage();

    expect(await screen.findByText("Your venues")).toBeInTheDocument();
    const venues = multiCompanyPortfolio.companies.flatMap(
      (company) => company.businesses,
    );
    const openBusinessActions = screen.getAllByRole("button", {
      name: "Open business",
    });
    expect(openBusinessActions).toHaveLength(venues.length);
    for (const action of openBusinessActions) {
      const card = action.closest("li");
      expect(card).not.toBeNull();
      expect(
        venues.some((venue) =>
          within(card as HTMLElement).queryByText(venue.tradeName),
        ),
      ).toBe(true);
    }
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

  it("warns about an incomplete draft venue and links to its profile", async () => {
    mockGet.mockResolvedValue({ data: populatedPortfolio });

    await renderPage();

    expect(await screen.findByText(incompleteWarning)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: completeProfileLink }),
    ).toHaveAttribute("href", "/business/b1/settings/profile");
    expect(
      screen.getByRole("link", { name: completeAddressLink }),
    ).toHaveAttribute("href", "/business/b1/settings/address");
    expect(
      screen.getByRole("link", { name: completeCompanyLink }),
    ).toHaveAttribute("href", "/business/b1/company");
  });

  it("shows no warning for a venue with a complete identity/contact profile and Company tax identity", async () => {
    mockGet.mockResolvedValue({ data: completePortfolio });

    await renderPage();

    expect(await screen.findByText("Demo Bistro")).toBeInTheDocument();
    expect(screen.queryByText(incompleteWarning)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: completeProfileLink }),
    ).not.toBeInTheDocument();
  });

  it("warns only on incomplete venues in a mixed portfolio", async () => {
    mockGet.mockResolvedValue({ data: mixedPortfolio });

    await renderPage();

    expect(await screen.findByText("Your venues")).toBeInTheDocument();
    expect(screen.getAllByText(incompleteWarning)).toHaveLength(1);

    const incompleteCard = screen.getByText("Demo Bistro").closest("li");
    expect(incompleteCard).not.toBeNull();
    expect(
      within(incompleteCard as HTMLElement).getByText(incompleteWarning),
    ).toBeInTheDocument();
    expect(
      within(incompleteCard as HTMLElement).getByRole("link", {
        name: completeProfileLink,
      }),
    ).toHaveAttribute("href", "/business/b1/settings/profile");

    const completeCard = screen.getByText("Complete Bistro").closest("li");
    expect(completeCard).not.toBeNull();
    expect(
      within(completeCard as HTMLElement).queryByText(incompleteWarning),
    ).not.toBeInTheDocument();
    expect(
      within(completeCard as HTMLElement).queryByRole("link", {
        name: completeProfileLink,
      }),
    ).not.toBeInTheDocument();
  });

  it("warns once per incomplete venue in a portfolio with multiple drafts", async () => {
    mockGet.mockResolvedValue({ data: multiCompanyPortfolio });

    await renderPage();

    expect(await screen.findByText("Your venues")).toBeInTheDocument();
    const venues = multiCompanyPortfolio.companies.flatMap(
      (company) => company.businesses,
    );

    expect(screen.getAllByText(incompleteWarning)).toHaveLength(venues.length);
    expect(
      screen.getAllByRole("link", { name: completeProfileLink }),
    ).toHaveLength(venues.length);

    for (const venue of venues) {
      const card = screen.getByText(venue.tradeName).closest("li");
      expect(card).not.toBeNull();
      expect(
        within(card as HTMLElement).getAllByText(incompleteWarning),
      ).toHaveLength(1);
      expect(
        within(card as HTMLElement).getByRole("link", {
          name: completeProfileLink,
        }),
      ).toHaveAttribute("href", `/business/${venue._id}/settings/profile`);
    }
  });

  it("renders the incomplete warning and completion link in Spanish", async () => {
    mockGet.mockResolvedValue({ data: populatedPortfolio });

    await renderPage("es");

    expect(
      await screen.findByText(
        "Este local debe completarse antes de que pueda publicarse.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Completar perfil del local" }),
    ).toHaveAttribute("href", "/business/b1/settings/profile");
    expect(
      screen.getByRole("link", { name: "Completar dirección del local" }),
    ).toHaveAttribute("href", "/business/b1/settings/address");
    expect(
      screen.getByRole("link", { name: "Completar datos de la empresa" }),
    ).toHaveAttribute("href", "/business/b1/company");
    expect(screen.queryByText(incompleteWarning)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: completeProfileLink }),
    ).not.toBeInTheDocument();
  });

  it("groups venues by Company so multiple Companies are distinguishable", async () => {
    mockGet.mockResolvedValue({ data: multiCompanyPortfolio });

    await renderPage();

    expect(
      await screen.findByRole("heading", { name: "Demo Bistro SL" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Second Taxpayer SL" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Demo Bistro")).toBeInTheDocument();
    expect(screen.getByText("Corner Cafe")).toBeInTheDocument();
    expect(screen.getByText("Third Venue")).toBeInTheDocument();
    expect(screen.getByText("Tax number B12345678")).toBeInTheDocument();
    expect(screen.getByText("Tax number B87654321")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Company 3" }),
    ).toBeInTheDocument();
  });

  it("joins a later venue to an existing Company from the add-venue form", async () => {
    mockGet
      .mockResolvedValueOnce({ data: multiCompanyPortfolio })
      .mockResolvedValue({ data: joinedPortfolio });
    mockPost.mockResolvedValue({
      data: {
        business: {
          _id: "b3",
          tradeName: "New Cafe",
          currencyTrade: "USD",
          companyId: "c2",
        },
        company: {
          _id: "c2",
          country: "Spain",
          legalName: "Second Taxpayer SL",
        },
      },
    });
    const user = userEvent.setup();
    await renderPage();

    await user.click(await screen.findByRole("button", { name: "Add venue" }));

    const companySelect = screen.getByRole("combobox", { name: "Company" });
    expect(companySelect).toHaveTextContent("Select a Company");
    expect(
      screen.queryByLabelText("Company legal name"),
    ).not.toBeInTheDocument();

    await user.click(companySelect);
    expect(
      await screen.findByRole("option", { name: "New Company" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("option", { name: "Second Taxpayer SL" }),
    );

    expect(
      screen.queryByLabelText("Company legal name"),
    ).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Trade name"), "New Cafe");
    await user.click(screen.getByRole("button", { name: "Create venue" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/api/v1/business",
        {
          tradeName: "New Cafe",
          country: "Spain",
          currencyTrade: "USD",
          companyId: "c2",
        },
        expect.anything(),
      );
    });
    expect(await screen.findByText("New Cafe")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create venue" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalledWith(
      "/api/v1/auth/set-mode",
      expect.anything(),
    );
  });

  it("reveals the optional legal name and tax number only for a New Company", async () => {
    mockGet.mockResolvedValue({ data: populatedPortfolio });
    mockPost.mockResolvedValue({
      data: {
        business: {
          _id: "b2",
          tradeName: "Second Bistro",
          currencyTrade: "USD",
          companyId: "c2",
        },
        company: {
          _id: "c2",
          country: "Spain",
          legalName: "Second Taxpayer SL",
          taxNumber: "B87654321",
        },
      },
    });
    const user = userEvent.setup();
    await renderPage();

    await user.click(await screen.findByRole("button", { name: "Add venue" }));
    expect(
      screen.queryByLabelText("Company legal name"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Company" }));
    await user.click(screen.getByRole("option", { name: "New Company" }));

    await user.type(screen.getByLabelText("Trade name"), "Second Bistro");
    await user.type(
      screen.getByLabelText("Company legal name"),
      "Second Taxpayer SL",
    );
    await user.type(
      screen.getByLabelText("Company tax number"),
      "B87654321",
    );
    await user.click(screen.getByRole("button", { name: "Create venue" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/api/v1/business",
        {
          tradeName: "Second Bistro",
          country: "Spain",
          currencyTrade: "USD",
          company: {
            legalName: "Second Taxpayer SL",
            taxNumber: "B87654321",
          },
        },
        expect.anything(),
      );
    });
  });

  it("requires an explicit Company before creating a later venue", async () => {
    mockGet.mockResolvedValue({ data: populatedPortfolio });
    const user = userEvent.setup();
    await renderPage();

    await user.click(await screen.findByRole("button", { name: "Add venue" }));
    await user.type(screen.getByLabelText("Trade name"), "Unassigned Venue");
    await user.click(screen.getByRole("button", { name: "Create venue" }));

    expect(
      await screen.findByText("Choose the Company this venue belongs to."),
    ).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });
});

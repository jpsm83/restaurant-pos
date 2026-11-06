import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IAuthAccessibleVenue } from "restaurant-pos-packages/interfaces/IAuth";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/services/queryKeys";
import {
  renderWithI18n,
  type RenderWithI18nOptions,
} from "@/test/i18nTestUtils";
import BusinessLayout from "../BusinessLayout";

const {
  mockUseAuth,
  mockSetAuthMode,
  mockPortfolio,
  mockAccess,
  mockVenues,
  mockGet,
  mockPost,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockSetAuthMode: vi.fn(),
  mockAccess: {
    value: {
      data: {
        businessId: "b1",
        effectiveLayer: "employee",
        source: "membership",
        jobRoles: ["Waiter"],
        capabilities: [],
        canEnterBusiness: true,
      },
    } as { data?: unknown },
  },
  mockPortfolio: {
    value: {
      owner: { _id: "o1", country: "USA", subscription: "Free" },
      country: "USA",
      subscription: "Free",
      companies: [] as Array<{
        _id: string;
        country: string;
        legalName?: string;
        taxNumber?: string;
        businesses: Array<{
          _id: string;
          tradeName: string;
          currencyTrade: string;
          companyId: string;
          profileComplete: boolean;
        }>;
      }>,
    },
  },
  mockVenues: {
    value: [] as IAuthAccessibleVenue[],
  },
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
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/services/authMode", () => ({
  useSetAuthModeMutation: () => ({
    mutateAsync: mockSetAuthMode,
    isPending: false,
  }),
}));

vi.mock("@/services/employees/employeesService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/employees/employeesService")>();
  return {
    ...actual,
    useBusinessAccessSnapshotQuery: () => mockAccess.value,
  };
});

vi.mock("@/services/portfolio/portfolioService", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/services/portfolio/portfolioService")
    >();
  return {
    ...actual,
    useOwnerPortfolioQuery: () => ({ data: mockPortfolio.value }),
  };
});

vi.mock("@/components/ActorSidebar", () => ({
  default: ({
    pages,
    subPages,
  }: {
    pages?: Array<{ label: string }>;
    subPages?: Array<{
      key: string;
      label: string;
      to: string;
      isActive: boolean;
      groupName: string;
    }>;
  }) => (
    <nav data-testid="actor-sidebar">
      <span data-testid="sidebar-pages">
        {(pages ?? []).map((p) => p.label).join("|")}
      </span>
      {(subPages ?? []).map((page) => (
        <a
          key={page.key}
          href={page.to}
          data-group={page.groupName}
          data-label={page.label}
          data-active={page.isActive ? "true" : "false"}
        >
          {page.label}
        </a>
      ))}
    </nav>
  ),
}));

vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children: ReactNode }) => <aside>{children}</aside>,
  SidebarFooter: ({ children }: { children: ReactNode }) => (
    <footer>{children}</footer>
  ),
  SidebarRail: () => <div data-testid="sidebar-rail" />,
}));

function venue(
  overrides: Partial<IAuthAccessibleVenue> = {},
): IAuthAccessibleVenue {
  return {
    businessId: "b1",
    tradeName: "Owned Venue",
    source: "ownership",
    effectiveLayer: "admin",
    jobRoles: [],
    capabilities: [],
    canEnterBusiness: true,
    ...overrides,
  };
}

function authenticatedUser() {
  return {
    state: {
      status: "authenticated",
      user: {
        id: "u1",
        email: "u@test.local",
        type: "user",
        mode: "business",
        role: "Manager",
      },
      error: null,
    },
  };
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderBusinessLayout(
  initialEntry = "/business/b1/dashboard",
  language?: RenderWithI18nOptions["language"],
) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  client.setQueryData(queryKeys.auth.venues(), mockVenues.value);

  return renderWithI18n(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Routes>
        <Route path="/business/:businessId" element={<BusinessLayout />}>
          <Route path="dashboard" element={<div>Business Outlet</div>} />
          <Route path="company" element={<div>Company page</div>} />
          <Route path="notifications" element={<div>Notifications page</div>} />
        </Route>
        <Route path="/dashboard" element={<div>Customer dashboard</div>} />
      </Routes>
    </MemoryRouter>,
    {
      language,
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
}

describe("BusinessLayout", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockSetAuthMode.mockReset();
    mockSetAuthMode.mockResolvedValue(undefined);
    mockGet.mockReset();
    mockPost.mockReset();
    mockAccess.value = {
      data: {
        businessId: "b1",
        effectiveLayer: "employee",
        source: "membership",
        jobRoles: ["Waiter"],
        capabilities: [],
        canEnterBusiness: true,
      },
    };
    mockPortfolio.value = {
      owner: { _id: "o1", country: "USA", subscription: "Free" },
      country: "USA",
      subscription: "Free",
      companies: [],
    };
    mockVenues.value = [venue()];
    mockGet.mockImplementation((url: unknown) => {
      if (url === "/api/v1/auth/venues") {
        return Promise.resolve({ data: { venues: mockVenues.value } });
      }
      return Promise.reject(new Error(`unexpected GET ${String(url)}`));
    });
    mockUseAuth.mockReturnValue(authenticatedUser());
  });

  it("renders null when there is no authenticated User", async () => {
    mockUseAuth.mockReturnValue({
      state: {
        status: "unauthenticated",
        user: null,
        error: null,
      },
    });

    await renderBusinessLayout();

    expect(screen.queryByText("Business Outlet")).not.toBeInTheDocument();
  });

  it("renders sidebar and outlet for an authenticated User", async () => {
    await renderBusinessLayout();

    expect(screen.getByTestId("actor-sidebar")).toBeInTheDocument();
    expect(screen.getByText("Business Outlet")).toBeInTheDocument();
  });

  it("does not render a Business Me group", async () => {
    await renderBusinessLayout();

    const nav = screen.getByTestId("actor-sidebar");
    const selfOnlyLinks = within(nav)
      .queryAllByRole("link")
      .filter((link) => ["Me", "Yo"].includes(link.getAttribute("data-group") ?? ""));

    expect(selfOnlyLinks).toHaveLength(0);
    expect(nav).not.toHaveTextContent("Notifications");
    expect(nav).not.toHaveTextContent("Preferences");
  });

  it("renders no tab strip for a single-venue session", async () => {
    await renderBusinessLayout();

    expect(
      screen.queryByRole("navigation", { name: "Venues" }),
    ).not.toBeInTheDocument();
  });

  it("renders tabs and marks the active venue", async () => {
    mockVenues.value = [
      venue({ businessId: "b1", tradeName: "Alpha Bar" }),
      venue({ businessId: "b2", tradeName: "Beta Bar", source: "membership" }),
    ];

    await renderBusinessLayout("/business/b1/dashboard");

    const tabs = screen.getByRole("navigation", { name: "Venues" });
    expect(within(tabs).getByRole("link", { name: "Alpha Bar" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      within(tabs).getByRole("link", { name: "Beta Bar" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("switches venue from a tab without changing mode", async () => {
    mockVenues.value = [
      venue({ businessId: "b1", tradeName: "Alpha Bar" }),
      venue({ businessId: "b2", tradeName: "Beta Bar", source: "membership" }),
    ];
    const user = userEvent.setup();

    await renderBusinessLayout("/business/b1/dashboard");

    const tabs = screen.getByRole("navigation", { name: "Venues" });
    await user.click(within(tabs).getByRole("link", { name: "Beta Bar" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/business/b2/dashboard",
      );
    });
    expect(mockSetAuthMode).not.toHaveBeenCalled();
  });

  it("omits venues that cannot enter Business from the tab strip", async () => {
    mockVenues.value = [
      venue({ businessId: "b1", tradeName: "Alpha Bar" }),
      venue({
        businessId: "b2",
        tradeName: "Beta Bar",
        source: "membership",
        canEnterBusiness: false,
      }),
    ];

    await renderBusinessLayout("/business/b1/dashboard");

    expect(
      screen.queryByRole("navigation", { name: "Venues" }),
    ).not.toBeInTheDocument();
  });

  it("shows Owner chrome on an owned venue without Plan or Billing", async () => {
    await renderBusinessLayout();

    expect(screen.getByRole("button", { name: "Add venue" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Company" })).toHaveAttribute(
      "href",
      "/business/b1/company",
    );
    expect(screen.queryByRole("link", { name: "Plan" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Billing" }),
    ).not.toBeInTheDocument();
  });

  it("warns inside the Business shell when the owned venue profile is incomplete", async () => {
    mockPortfolio.value = {
      owner: { _id: "o1", country: "USA", subscription: "Free" },
      country: "USA",
      subscription: "Free",
      companies: [
        {
          _id: "c1",
          country: "USA",
          businesses: [
            {
              _id: "b1",
              tradeName: "Owned Venue",
              currencyTrade: "USD",
              companyId: "c1",
              profileComplete: false,
            },
          ],
        },
      ],
    };

    await renderBusinessLayout();

    expect(
      await screen.findByText(
        "This venue must be completed before it can go live.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Complete venue profile" }),
    ).toHaveAttribute("href", "/business/b1/settings/profile");
    expect(
      screen.getByRole("link", { name: "Complete venue address" }),
    ).toHaveAttribute("href", "/business/b1/settings/address");
    expect(
      screen.getByRole("link", { name: "Complete Company details" }),
    ).toHaveAttribute("href", "/business/b1/company");
  });

  it("does not warn inside the Business shell for a complete venue profile", async () => {
    mockPortfolio.value = {
      owner: { _id: "o1", country: "USA", subscription: "Free" },
      country: "USA",
      subscription: "Free",
      companies: [
        {
          _id: "c1",
          country: "USA",
          businesses: [
            {
              _id: "b1",
              tradeName: "Owned Venue",
              currencyTrade: "USD",
              companyId: "c1",
              profileComplete: true,
            },
          ],
        },
      ],
    };

    await renderBusinessLayout();

    expect(
      screen.queryByText(
        "This venue must be completed before it can go live.",
      ),
    ).not.toBeInTheDocument();
  });

  it("falls back to the portfolio while the venue list is empty", async () => {
    mockVenues.value = [];
    mockPortfolio.value = {
      owner: { _id: "o1", country: "USA", subscription: "Free" },
      country: "USA",
      subscription: "Free",
      companies: [
        {
          _id: "c1",
          country: "USA",
          businesses: [
            {
              _id: "b1",
              tradeName: "Owned Venue",
              currencyTrade: "USD",
              companyId: "c1",
              profileComplete: true,
            },
          ],
        },
      ],
    };

    await renderBusinessLayout();

    expect(screen.getByRole("button", { name: "Add venue" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Company" })).toBeInTheDocument();
  });

  it("hides Owner chrome on a member-only venue", async () => {
    mockVenues.value = [
      venue({ source: "membership", effectiveLayer: "employee" }),
    ];

    await renderBusinessLayout();

    expect(screen.getByTestId("actor-sidebar")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add venue" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Company" }),
    ).not.toBeInTheDocument();
  });

  it("adds a venue through the shared form and shows it as a tab", async () => {
    mockPost.mockImplementation(() => {
      mockVenues.value = [
        ...mockVenues.value,
        venue({ businessId: "b2", tradeName: "New Venue" }),
      ];
      return Promise.resolve({
        data: {
          business: {
            _id: "b2",
            tradeName: "New Venue",
            currencyTrade: "USD",
          },
          company: { _id: "c2", country: "USA" },
        },
      });
    });
    const user = userEvent.setup();

    await renderBusinessLayout();

    await user.click(screen.getByRole("button", { name: "Add venue" }));
    await user.type(await screen.findByLabelText("Trade name"), "New Venue");
    await user.click(screen.getByRole("button", { name: "Create venue" }));

    expect(
      await screen.findByRole("link", { name: "New Venue" }),
    ).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith(
      "/api/v1/business",
      expect.objectContaining({ tradeName: "New Venue", country: "USA" }),
      expect.anything(),
    );
  });

  it.each(["manager", "admin"])(
    "shows the People entry for a %s",
    async (layer) => {
      mockAccess.value = {
        data: {
          businessId: "b1",
          effectiveLayer: layer,
          source: "membership",
          jobRoles: [layer],
          capabilities: [],
          canEnterBusiness: true,
        },
      };

      await renderBusinessLayout();

      expect(screen.getByTestId("actor-sidebar")).toHaveTextContent(
        "Dashboard|People",
      );
    },
  );

  it("hides the People entry for a supervisor", async () => {
    mockAccess.value = {
      data: {
        businessId: "b1",
        effectiveLayer: "supervisor",
        source: "membership",
        jobRoles: ["Supervisor"],
        capabilities: [],
        canEnterBusiness: true,
      },
    };

    await renderBusinessLayout();

    expect(screen.getByTestId("actor-sidebar")).not.toHaveTextContent("People");
  });

  it.each(["employee", "supervisor"])(
    "shows only the Service destinations for a %s",
    async (layer) => {
      mockAccess.value = {
        data: {
          businessId: "b1",
          effectiveLayer: layer,
          source: "membership",
          jobRoles: [layer],
          capabilities: [],
          canEnterBusiness: true,
        },
      };

      await renderBusinessLayout();

      const nav = screen.getByTestId("actor-sidebar");
      expect(nav).toHaveTextContent("Dashboard");
      expect(nav).not.toHaveTextContent("Notifications");
      expect(nav).not.toHaveTextContent("Preferences");
      const manageLinks = within(nav)
        .queryAllByRole("link")
        .filter((link) => link.getAttribute("data-group") === "Manage");
      expect(manageLinks).toHaveLength(0);
      expect(nav).not.toHaveTextContent("Open hours");
      expect(nav).not.toHaveTextContent("Delivery");
      expect(nav).not.toHaveTextContent("Metrics");
      expect(nav).not.toHaveTextContent("People");
    },
  );

  it.each(["manager", "admin"])(
    "shows the Manage settings group for a %s",
    async (layer) => {
      mockAccess.value = {
        data: {
          businessId: "b1",
          effectiveLayer: layer,
          source: "membership",
          jobRoles: [layer],
          capabilities: [],
          canEnterBusiness: true,
        },
      };

      await renderBusinessLayout();

      const nav = screen.getByTestId("actor-sidebar");
      const manageLinks = within(nav)
        .getAllByRole("link")
        .filter((link) => link.getAttribute("data-group") === "Manage");
      expect(manageLinks.map((link) => link.textContent)).toEqual([
        "Open hours",
        "Delivery",
        "Metrics",
      ]);
    },
  );

  it("renders venue tabs and Owner chrome in Spanish", async () => {
    mockVenues.value = [
      venue({ businessId: "b1", tradeName: "Alpha Bar" }),
      venue({ businessId: "b2", tradeName: "Beta Bar", source: "membership" }),
    ];

    await renderBusinessLayout("/business/b1/dashboard", "es");

    expect(
      screen.getByRole("navigation", { name: "Locales" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Añadir local" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Empresa" })).toBeInTheDocument();
  });

  it("returns to customer mode and navigates to the Customer dashboard", async () => {
    const user = userEvent.setup();

    await renderBusinessLayout();

    await user.click(screen.getByRole("button", { name: "Customer mode" }));

    await waitFor(() => {
      expect(mockSetAuthMode).toHaveBeenCalledWith("customer");
    });
    expect(await screen.findByText("Customer dashboard")).toBeInTheDocument();
  });
});

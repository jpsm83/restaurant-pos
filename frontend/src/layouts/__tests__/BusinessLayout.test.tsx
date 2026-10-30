import type { ReactNode } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import BusinessLayout from "../BusinessLayout";

const mockUseAuth = vi.fn();
const { mockSetAuthMode, mockPortfolio } = vi.hoisted(() => ({
  mockSetAuthMode: vi.fn(),
  mockPortfolio: {
    value: {
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
    } as {
      owner: { _id: string; country: string; subscription: string } | null;
      country: string | null;
      subscription: string | null;
      companies: Array<{
        _id: string;
        country: string;
        businesses: Array<{
          _id: string;
          tradeName: string;
          currencyTrade: string;
          companyId: string;
          profileComplete: boolean;
        }>;
      }>;
    },
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

vi.mock("@/services/portfolio/portfolioService", () => ({
  hasOwnedBusiness: (
    portfolio: { companies: Array<{ businesses: Array<{ _id: string }> }> } | undefined,
    businessId: string,
  ) =>
    Boolean(
      portfolio?.companies.some((company) =>
        company.businesses.some((business) => business._id === businessId),
      ),
    ),
  useOwnerPortfolioQuery: () => ({ data: mockPortfolio.value }),
}));

vi.mock("@/components/ActorSidebar", () => ({
  default: ({
    pages,
    subPages,
  }: {
    pages?: Array<{ label: string }>;
    subPages?: Array<{ label: string }>;
  }) => (
    <nav data-testid="actor-sidebar">
      {(pages ?? []).map((p) => p.label).join("|")}::{(subPages ?? [])
        .map((p) => p.label)
        .join("|")}
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

describe("BusinessLayout", () => {
  beforeEach(() => {
    mockSetAuthMode.mockReset();
    mockSetAuthMode.mockResolvedValue(undefined);
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
  });

  it("renders null when there is no authenticated User", async () => {
    mockUseAuth.mockReturnValue({
      state: {
        status: "unauthenticated",
        user: null,
        error: null,
      },
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/business/b1/dashboard"]}>
        <Routes>
          <Route path="/business/:businessId" element={<BusinessLayout />}>
            <Route path="dashboard" element={<div>Business Outlet</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Business Outlet")).not.toBeInTheDocument();
  });

  it("renders sidebar and outlet for an authenticated User", async () => {
    mockUseAuth.mockReturnValue({
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
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/business/b1/dashboard"]}>
        <Routes>
          <Route path="/business/:businessId" element={<BusinessLayout />}>
            <Route path="dashboard" element={<div>Business Outlet</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("actor-sidebar")).toBeInTheDocument();
    expect(screen.getByText("Business Outlet")).toBeInTheDocument();
  });

  it("shows the Company owner entry only for an owned venue", async () => {
    mockUseAuth.mockReturnValue({
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
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/business/b1/dashboard"]}>
        <Routes>
          <Route path="/business/:businessId" element={<BusinessLayout />}>
            <Route path="dashboard" element={<div>Business Outlet</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("actor-sidebar")).toHaveTextContent(
      "Dashboard|Company",
    );
  });

  it("hides the Company entry for a venue the User does not own", async () => {
    mockPortfolio.value = {
      owner: null,
      country: null,
      subscription: null,
      companies: [],
    };
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: {
          id: "u1",
          email: "u@test.local",
          type: "user",
          mode: "business",
          role: "Employee",
        },
        error: null,
      },
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/business/b1/dashboard"]}>
        <Routes>
          <Route path="/business/:businessId" element={<BusinessLayout />}>
            <Route path="dashboard" element={<div>Business Outlet</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("actor-sidebar")).not.toHaveTextContent(
      "Company",
    );
  });

  it("returns to customer mode and navigates to the Customer dashboard", async () => {
    mockUseAuth.mockReturnValue({
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
    });
    const user = userEvent.setup();

    await renderWithI18n(
      <MemoryRouter initialEntries={["/business/b1/dashboard"]}>
        <Routes>
          <Route path="/business/:businessId" element={<BusinessLayout />}>
            <Route path="dashboard" element={<div>Business Outlet</div>} />
          </Route>
          <Route
            path="/:userId/customer/dashboard"
            element={<div>Customer dashboard</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Customer mode" }),
    );

    await waitFor(() => {
      expect(mockSetAuthMode).toHaveBeenCalledWith("customer");
    });
    expect(await screen.findByText("Customer dashboard")).toBeInTheDocument();
  });
});

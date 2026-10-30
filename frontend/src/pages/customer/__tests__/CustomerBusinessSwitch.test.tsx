import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BusinessLayout from "@/layouts/BusinessLayout";
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

vi.mock("@/components/ActorSidebar", () => ({
  default: ({ pages }: { pages: Array<{ label: string }> }) => (
    <nav data-testid="actor-sidebar">{pages.map((page) => page.label).join("|")}</nav>
  ),
}));

vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children: ReactNode }) => <aside>{children}</aside>,
  SidebarFooter: ({ children }: { children: ReactNode }) => (
    <footer>{children}</footer>
  ),
  SidebarRail: () => <div data-testid="sidebar-rail" />,
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
      ],
    },
  ],
};

function renderSwitchFlow() {
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
          <Route path="/business/:businessId" element={<BusinessLayout />}>
            <Route path="dashboard" element={<div>Business dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Customer | Business switch", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockGet.mockResolvedValue({ data: portfolio });
    mockPost.mockResolvedValue({
      data: { message: "Auth mode set successfully", mode: "business" },
    });
  });

  it("opens an owned venue in business mode and returns to the same portfolio", async () => {
    const user = userEvent.setup();

    await renderSwitchFlow();

    await user.click(
      await screen.findByRole("button", { name: "Open business" }),
    );

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/api/v1/auth/set-mode", {
        mode: "business",
      });
    });
    expect(await screen.findByText("Business dashboard")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Customer mode" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenLastCalledWith("/api/v1/auth/set-mode", {
        mode: "customer",
      });
    });
    expect(await screen.findByText("Your venues")).toBeInTheDocument();
    expect(screen.getByText("Demo Bistro")).toBeInTheDocument();
  });
});

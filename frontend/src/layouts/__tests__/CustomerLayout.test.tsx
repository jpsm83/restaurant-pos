import type { ReactNode } from "react";
import { screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import CustomerLayout from "../CustomerLayout";

const mockUseAuth = vi.fn();

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/components/ActorSidebar", () => ({
  default: ({ pages }: { pages: Array<{ label: string }> }) => (
    <nav data-testid="actor-sidebar">{pages.map((p) => p.label).join("|")}</nav>
  ),
}));

vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children: ReactNode }) => <aside>{children}</aside>,
  SidebarRail: () => <div data-testid="sidebar-rail" />,
}));

describe("CustomerLayout", () => {
  it("renders null when session is not an authenticated user", async () => {
    mockUseAuth.mockReturnValue({
      state: { status: "unauthenticated", user: null, error: null },
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/u1/customer/dashboard"]}>
        <Routes>
          <Route path="/:userId/customer" element={<CustomerLayout />}>
            <Route path="dashboard" element={<div>Customer Outlet</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Customer Outlet")).not.toBeInTheDocument();
  });

  it("renders sidebar and outlet for authenticated user session", async () => {
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: { id: "u1", email: "u@test.local", type: "user", role: "Customer" },
        error: null,
      },
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/u1/customer/dashboard"]}>
        <Routes>
          <Route path="/:userId/customer" element={<CustomerLayout />}>
            <Route path="dashboard" element={<div>Customer Outlet</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("actor-sidebar")).toBeInTheDocument();
    expect(screen.getByText("Customer Outlet")).toBeInTheDocument();
  });
});

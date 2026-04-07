import type { ReactNode } from "react";
import { screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import BusinessLayout from "../BusinessLayout";

const mockUseAuth = vi.fn();

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
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
  SidebarRail: () => <div data-testid="sidebar-rail" />,
}));

describe("BusinessLayout", () => {
  it("renders null when session is not an authenticated business", async () => {
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: { id: "u1", email: "u@test.local", type: "user", role: "Customer" },
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

  it("renders sidebar and outlet for authenticated business session", async () => {
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: { id: "b1", email: "b@test.local", type: "business", role: "Tenant" },
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
});

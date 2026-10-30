import type { ReactNode } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import BusinessLayout from "../BusinessLayout";

const mockUseAuth = vi.fn();
const { mockSetAuthMode } = vi.hoisted(() => ({
  mockSetAuthMode: vi.fn(),
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

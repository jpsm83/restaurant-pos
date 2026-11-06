import type { ReactNode } from "react";
import { screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import CustomerAccountLayout from "../CustomerAccountLayout";

const mockUseAuth = vi.fn();

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/components/ActorSidebar", () => ({
  default: ({
    pages,
  }: {
    pages: Array<{ key: string; label: string; to: string; isActive: boolean }>;
  }) => (
    <nav data-testid="actor-sidebar">
      {pages.map((page) => (
        <a
          key={page.key}
          href={page.to}
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
  SidebarRail: () => <div data-testid="sidebar-rail" />,
}));

describe("CustomerAccountLayout", () => {
  it("renders null when session is not an authenticated user", async () => {
    mockUseAuth.mockReturnValue({
      state: { status: "unauthenticated", user: null, error: null },
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/account/profile"]}>
        <Routes>
          <Route element={<CustomerAccountLayout />}>
            <Route path="account/profile" element={<div>Account Outlet</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Account Outlet")).not.toBeInTheDocument();
  });

  it("shows only the built account destinations", async () => {
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: { id: "u1", email: "u@test.local", type: "user", role: "Customer" },
        error: null,
      },
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/account/profile"]}>
        <Routes>
          <Route element={<CustomerAccountLayout />}>
            <Route path="account/profile" element={<div>Account Outlet</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Account Outlet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/account/profile",
    );
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(screen.getByRole("link", { name: "Address" })).toHaveAttribute(
      "href",
      "/account/address",
    );
    expect(screen.getByRole("link", { name: "Address" })).toHaveAttribute(
      "data-active",
      "false",
    );
    expect(screen.getByRole("link", { name: "Notifications" })).toHaveAttribute(
      "href",
      "/account/notifications",
    );
    expect(
      screen.getByRole("link", { name: "Notifications" }),
    ).toHaveAttribute("data-active", "false");
    expect(screen.getByRole("link", { name: "Preferences" })).toHaveAttribute(
      "href",
      "/account/preferences",
    );
    expect(
      screen.getByRole("link", { name: "Preferences" }),
    ).toHaveAttribute("data-active", "false");
    expect(screen.getByRole("link", { name: "Orders" })).toHaveAttribute(
      "href",
      "/account/orders",
    );
    expect(screen.getByRole("link", { name: "Orders" })).toHaveAttribute(
      "data-active",
      "false",
    );
    expect(
      screen.getAllByRole("link").map((link) => link.textContent),
    ).toEqual([
      "Profile",
      "Address",
      "Notifications",
      "Preferences",
      "Orders",
    ]);
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Favorites" })).not.toBeInTheDocument();
  });

  it("marks Notifications active and localizes its label", async () => {
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: { id: "u1", email: "u@test.local", type: "user", role: "Customer" },
        error: null,
      },
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/account/notifications"]}>
        <Routes>
          <Route element={<CustomerAccountLayout />}>
            <Route
              path="account/notifications"
              element={<div>Notifications Outlet</div>}
            />
          </Route>
        </Routes>
      </MemoryRouter>,
      { language: "es" },
    );

    expect(screen.getByText("Notifications Outlet")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Notificaciones" }),
    ).toHaveAttribute("href", "/account/notifications");
    expect(
      screen.getByRole("link", { name: "Notificaciones" }),
    ).toHaveAttribute("data-active", "true");
  });

  it("marks Preferences active and localizes its label", async () => {
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: { id: "u1", email: "u@test.local", type: "user", role: "Customer" },
        error: null,
      },
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/account/preferences"]}>
        <Routes>
          <Route element={<CustomerAccountLayout />}>
            <Route
              path="account/preferences"
              element={<div>Preferences Outlet</div>}
            />
          </Route>
        </Routes>
      </MemoryRouter>,
      { language: "es" },
    );

    expect(screen.getByText("Preferences Outlet")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Preferencias" }),
    ).toHaveAttribute("href", "/account/preferences");
    expect(
      screen.getByRole("link", { name: "Preferencias" }),
    ).toHaveAttribute("data-active", "true");
  });
});

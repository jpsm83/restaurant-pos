import { screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@/appRoutes";
import { renderWithI18n } from "@/test/i18nTestUtils";

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

const { mockUseAuth, mockAuthMode } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockAuthMode: {
    mode: "customer" as "customer" | "business" | undefined,
    isLoading: false,
    isError: false,
    setModeAndRefresh: vi.fn(),
  },
}));

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/context/AuthModeContext", () => ({
  useAuthMode: () => mockAuthMode,
}));

vi.mock("@/layouts/CustomerAccountLayout", async () => {
  const { Outlet } = await import("react-router-dom");
  return { default: () => <Outlet /> };
});

vi.mock("@/pages/customer/CustomerProfilePage", () => ({
  default: () => <div data-testid="profile-page-stub">Profile page</div>,
}));

vi.mock("@/pages/customer/CustomerAddressPage", () => ({
  default: () => <div data-testid="address-page-stub">Address page</div>,
}));

vi.mock("@/pages/customer/CustomerSecurityPage", () => ({
  default: () => <div data-testid="security-page-stub">Security page</div>,
}));

vi.mock("@/pages/customer/CustomerPreferencesPage", () => ({
  default: () => (
    <div data-testid="preferences-page-stub">Preferences page</div>
  ),
}));

vi.mock("@/pages/customer/CustomerOrdersPage", () => ({
  default: () => <div data-testid="orders-page-stub">Orders page</div>,
}));

vi.mock("@/pages/notifications/NotificationsInboxPage", () => ({
  default: () => (
    <div data-testid="notifications-page-stub">Notifications page</div>
  ),
}));

describe("customer account routing", () => {
  beforeEach(() => {
    mockAuthMode.mode = "customer";
    mockAuthMode.setModeAndRefresh.mockReset();
    mockUseAuth.mockReturnValue({
      state: {
        user: { id: "u1", email: "u@test.local", type: "user", role: "Customer" },
        status: "authenticated",
        error: null,
      },
      dispatch: vi.fn(),
    });
  });

  function renderRoutes(initialEntry: string) {
    return renderWithI18n(
      <MemoryRouter initialEntries={[initialEntry]}>
        <LocationProbe />
        <AppRoutes />
      </MemoryRouter>,
    );
  }

  it("redirects /account to the account Profile", async () => {
    await renderRoutes("/account");

    expect(await screen.findByTestId("profile-page-stub")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        /^\/account\/profile$/,
      );
    });
  });

  it("redirects legacy /profile to the account Profile", async () => {
    await renderRoutes("/profile");

    expect(await screen.findByTestId("profile-page-stub")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        /^\/account\/profile$/,
      );
    });
  });

  it("renders the Address destination under /account", async () => {
    await renderRoutes("/account/address");

    expect(await screen.findByTestId("address-page-stub")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      /^\/account\/address$/,
    );
  });

  it("renders the Sign-in & security destination under /account", async () => {
    await renderRoutes("/account/security");

    expect(await screen.findByTestId("security-page-stub")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      /^\/account\/security$/,
    );
  });

  it("renders the Notifications destination under /account", async () => {
    await renderRoutes("/account/notifications");

    expect(
      await screen.findByTestId("notifications-page-stub"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      /^\/account\/notifications$/,
    );
  });

  it("renders the Preferences destination under /account", async () => {
    await renderRoutes("/account/preferences");

    expect(
      await screen.findByTestId("preferences-page-stub"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      /^\/account\/preferences$/,
    );
  });

  it("renders the Orders destination under /account", async () => {
    await renderRoutes("/account/orders");

    expect(await screen.findByTestId("orders-page-stub")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      /^\/account\/orders$/,
    );
  });

  it.each([
    ["/account/profile", "profile-page-stub"],
    ["/account/address", "address-page-stub"],
    ["/account/security", "security-page-stub"],
    ["/account/notifications", "notifications-page-stub"],
    ["/account/preferences", "preferences-page-stub"],
    ["/account/orders", "orders-page-stub"],
  ])(
    "does not change the stored Business mode when %s opens",
    async (entry, stub) => {
      mockAuthMode.mode = "business";

      await renderRoutes(entry);

      expect(await screen.findByTestId(stub)).toBeInTheDocument();
      expect(mockAuthMode.setModeAndRefresh).not.toHaveBeenCalled();
    },
  );
});

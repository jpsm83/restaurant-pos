/**
 * Tests for `AuthRouteGuards.tsx` — guards in isolation with mocked `useAuth`.
 * For full route integration, see `App.routing.test.tsx` and page-level tests.
 */
import { screen, waitFor } from "@testing-library/react";
import type { IAuthAccessibleVenue } from "restaurant-pos-packages/interfaces/IAuth";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import {
  BusinessRouteShell,
  CustomerRouteShell,
  ProtectedRoute,
  PublicOnlyRoute,
} from "../AuthRouteGuards";

function LocationProbe() {
  const location = useLocation();
  const returnTo = new URLSearchParams(location.search).get("returnTo");
  const modeNotice = (location.state as { modeNotice?: string } | null)
    ?.modeNotice;
  return (
    <div data-testid="location">
      {location.pathname}|{returnTo ?? ""}|{modeNotice ?? ""}
    </div>
  );
}

function CustomerDestination() {
  const location = useLocation();
  return (
    <output data-testid="customer-destination">
      {location.pathname}
      {(location.state as { modeNotice?: string } | null)?.modeNotice ?? ""}
    </output>
  );
}

const {
  mockUseAuth,
  mockSetModeAndRefresh,
  mockAuthMode,
  mockModeStore,
  mockVenues,
} = vi.hoisted(() => {
  type Mode = "customer" | "business" | undefined;
  let mode: Mode = "customer";
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };
  return {
    mockUseAuth: vi.fn(),
    mockSetModeAndRefresh: vi.fn(),
    mockAuthMode: {
      isLoading: false,
      isError: false,
    },
    mockModeStore: {
      get: () => mode,
      reset: (next: Mode) => {
        mode = next;
        emit();
      },
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
    mockVenues: {
      data: [] as IAuthAccessibleVenue[] | undefined,
      isLoading: false,
      isError: false,
    },
  };
});

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/context/AuthModeContext", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useAuthMode: () => ({
      ...mockAuthMode,
      mode: useSyncExternalStore(
        mockModeStore.subscribe,
        mockModeStore.get,
        mockModeStore.get,
      ),
      setModeAndRefresh: mockSetModeAndRefresh,
    }),
  };
});

vi.mock("@/services/authVenues", () => ({
  useAccessibleVenuesQuery: () => mockVenues,
}));

function venue(
  overrides: Partial<IAuthAccessibleVenue> = {},
): IAuthAccessibleVenue {
  return {
    businessId: "507f1f77bcf86cd799439011",
    tradeName: "Alpha Bar",
    source: "ownership",
    effectiveLayer: "admin",
    jobRoles: [],
    capabilities: [],
    canEnterBusiness: true,
    ...overrides,
  };
}

function signedInUser() {
  mockUseAuth.mockReturnValue({
    state: {
      status: "authenticated",
      user: { id: "u1", email: "john@doe.com", type: "user", role: "Customer" },
      error: null,
    },
  });
}

beforeEach(() => {
  mockUseAuth.mockReset();
  mockSetModeAndRefresh.mockReset();
  mockSetModeAndRefresh.mockResolvedValue(undefined);
  mockModeStore.reset("customer");
  mockAuthMode.isLoading = false;
  mockAuthMode.isError = false;
  mockVenues.data = [];
  mockVenues.isLoading = false;
  mockVenues.isError = false;
});

describe("Auth route guards", () => {
  it("redirects unauthenticated users from protected route to /login", async () => {
    mockUseAuth.mockReturnValue({
      state: { status: "unauthenticated", user: null, error: null },
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>Private content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("sends anonymous users to shared login with a safe returnTo", async () => {
    mockUseAuth.mockReturnValue({
      state: { status: "unauthenticated", user: null, error: null },
    });

    await renderWithI18n(
      <MemoryRouter
        initialEntries={["/favorites?tab=all"]}
      >
        <Routes>
          <Route path="/login" element={<LocationProbe />} />
          <Route
            path="/favorites"
            element={
              <ProtectedRoute>
                <div>Private content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/login|/favorites?tab=all",
    );
  });

  it("redirects authenticated users away from /login to canonical user shell", async () => {
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: { id: "u1", email: "john@doe.com", type: "user" },
        error: null,
      },
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/dashboard" element={<div>User customer shell</div>} />
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <div>Login page</div>
              </PublicOnlyRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("User customer shell")).toBeInTheDocument();
  });

  it("honours a safe returnTo when an authenticated user leaves a public-only route", async () => {
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: { id: "u1", email: "john@doe.com", type: "user" },
        error: null,
      },
    });

    await renderWithI18n(
      <MemoryRouter
        initialEntries={[
          "/login?returnTo=%2Ffavorites%3Ftab%3Dall",
        ]}
      >
        <Routes>
          <Route path="/favorites" element={<div>Favorites</div>} />
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <div>Login page</div>
              </PublicOnlyRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Favorites")).toBeInTheDocument();
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
  });

  it("honours a safe returnTo when an authenticated user leaves /signup", async () => {
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: { id: "u1", email: "john@doe.com", type: "user" },
        error: null,
      },
    });

    await renderWithI18n(
      <MemoryRouter
        initialEntries={["/signup?returnTo=%2Faccount%2Fprofile"]}
      >
        <Routes>
          <Route path="/account/profile" element={<div>Account profile</div>} />
          <Route
            path="/signup"
            element={
              <PublicOnlyRoute>
                <div>Signup page</div>
              </PublicOnlyRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Account profile")).toBeInTheDocument();
    expect(screen.queryByText("Signup page")).not.toBeInTheDocument();
  });

  it("falls back to the Customer dashboard for an unsafe returnTo", async () => {
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: { id: "u1", email: "john@doe.com", type: "user" },
        error: null,
      },
    });

    await renderWithI18n(
      <MemoryRouter
        initialEntries={["/signup?returnTo=https%3A%2F%2Fevil.example"]}
      >
        <Routes>
          <Route
            path="/dashboard"
            element={<div>Customer dashboard</div>}
          />
          <Route
            path="/signup"
            element={
              <PublicOnlyRoute>
                <div>Signup page</div>
              </PublicOnlyRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Customer dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Signup page")).not.toBeInTheDocument();
  });

  it("BusinessRouteShell redirects anonymous visitors to /login", async () => {
    mockUseAuth.mockReturnValue({
      state: { status: "unauthenticated", user: null, error: null },
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/business/507f1f77bcf86cd799439011"]}>
        <Routes>
          <Route path="/login" element={<div>Login page</div>} />
          <Route
            path="/business/:businessId"
            element={
              <BusinessRouteShell>
                <div>Venue page</div>
              </BusinessRouteShell>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("BusinessRouteShell renders venue pages for an authenticated User in Business mode", async () => {
    signedInUser();
    mockModeStore.reset("business");
    mockVenues.data = [venue()];

    await renderWithI18n(
      <MemoryRouter initialEntries={["/business/507f1f77bcf86cd799439011"]}>
        <Routes>
          <Route
            path="/business/:businessId"
            element={
              <BusinessRouteShell>
                <div>Venue page</div>
              </BusinessRouteShell>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Venue page")).toBeInTheDocument();
    expect(mockSetModeAndRefresh).not.toHaveBeenCalled();
  });

  it("renders Customer destinations for a signed-in User in Customer mode", async () => {
    signedInUser();

    await renderWithI18n(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <CustomerRouteShell>
                <div>Customer page</div>
              </CustomerRouteShell>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Customer page")).toBeInTheDocument();
    expect(mockSetModeAndRefresh).not.toHaveBeenCalled();
  });

  it("reconciles a stored Business mode when a Customer destination is visited", async () => {
    signedInUser();
    mockModeStore.reset("business");

    await renderWithI18n(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <CustomerRouteShell>
                <div>Customer page</div>
              </CustomerRouteShell>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Customer page")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockSetModeAndRefresh).toHaveBeenCalledWith("customer");
    });
  });

  it("shows localized copy when Customer mode reconciliation fails", async () => {
    signedInUser();
    mockModeStore.reset("business");
    mockSetModeAndRefresh.mockRejectedValue(new Error("offline"));

    await renderWithI18n(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <CustomerRouteShell>
                <div>Customer page</div>
              </CustomerRouteShell>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/we could not change your session to customer mode/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Customer page")).toBeInTheDocument();
  });

  it("shows Spanish copy when Customer mode reconciliation fails", async () => {
    signedInUser();
    mockModeStore.reset("business");
    mockSetModeAndRefresh.mockRejectedValue(new Error("offline"));

    await renderWithI18n(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <CustomerRouteShell>
                <div>Customer page</div>
              </CustomerRouteShell>
            }
          />
        </Routes>
      </MemoryRouter>,
      { language: "es" },
    );

    expect(
      await screen.findByText(/no pudimos cambiar tu sesión al modo cliente/i),
    ).toBeInTheDocument();
  });

  it("shows localized copy when the stored mode read fails", async () => {
    signedInUser();
    mockModeStore.reset(undefined);
    mockAuthMode.isError = true;

    await renderWithI18n(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <CustomerRouteShell>
                <div>Customer page</div>
              </CustomerRouteShell>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/could not check your workspace mode/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Customer page")).toBeInTheDocument();
  });

  it("explains a failed Business access check instead of claiming the venue is gone", async () => {
    signedInUser();
    mockModeStore.reset("business");
    mockVenues.isError = true;

    await renderWithI18n(
      <MemoryRouter initialEntries={["/business/507f1f77bcf86cd799439011"]}>
        <Routes>
          <Route path="/dashboard" element={<CustomerDestination />} />
          <Route
            path="/business/:businessId"
            element={
              <BusinessRouteShell>
                <div>Venue page</div>
              </BusinessRouteShell>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("customer-destination")).toHaveTextContent(
      "/dashboardbusinessCheckFailed",
    );
    expect(screen.queryByText("Venue page")).not.toBeInTheDocument();
  });

  it("switches an eligible Customer-mode Business deep link and continues to the destination", async () => {
    signedInUser();
    mockModeStore.reset("customer");
    mockVenues.data = [venue()];
    mockSetModeAndRefresh.mockImplementation(async () => {
      mockModeStore.reset("business");
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/business/507f1f77bcf86cd799439011"]}>
        <Routes>
          <Route
            path="/business/:businessId"
            element={
              <BusinessRouteShell>
                <div>Venue page</div>
              </BusinessRouteShell>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Venue page")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockSetModeAndRefresh).toHaveBeenCalledWith("business");
    });
  });

  it("explains a failed Business mode switch instead of claiming the venue is unavailable", async () => {
    signedInUser();
    mockModeStore.reset("customer");
    mockVenues.data = [venue()];
    mockSetModeAndRefresh.mockRejectedValue(new Error("offline"));

    await renderWithI18n(
      <MemoryRouter initialEntries={["/business/507f1f77bcf86cd799439011"]}>
        <Routes>
          <Route path="/dashboard" element={<CustomerDestination />} />
          <Route
            path="/business/:businessId"
            element={
              <BusinessRouteShell>
                <div>Venue page</div>
              </BusinessRouteShell>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("customer-destination")).toHaveTextContent(
        "/dashboardmodeSwitchFailed",
      );
    });
    expect(screen.queryByText("Venue page")).not.toBeInTheDocument();
  });

  it("refuses an ineligible Business deep link and explains with a Customer redirect", async () => {
    signedInUser();
    mockModeStore.reset("customer");
    mockVenues.data = [venue({ canEnterBusiness: false })];

    await renderWithI18n(
      <MemoryRouter initialEntries={["/business/507f1f77bcf86cd799439011"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={<CustomerDestination />}
          />
          <Route
            path="/business/:businessId"
            element={
              <BusinessRouteShell>
                <div>Venue page</div>
              </BusinessRouteShell>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("customer-destination")).toHaveTextContent(
      "/dashboardbusinessUnavailable",
    );
    expect(screen.queryByText("Venue page")).not.toBeInTheDocument();
    expect(mockSetModeAndRefresh).not.toHaveBeenCalled();
  });

  it("refuses a venue missing from the accessible list", async () => {
    signedInUser();
    mockModeStore.reset("customer");
    mockVenues.data = [venue({ businessId: "some-other-venue" })];

    await renderWithI18n(
      <MemoryRouter initialEntries={["/business/507f1f77bcf86cd799439011"]}>
        <Routes>
          <Route path="/dashboard" element={<CustomerDestination />} />
          <Route
            path="/business/:businessId"
            element={
              <BusinessRouteShell>
                <div>Venue page</div>
              </BusinessRouteShell>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("customer-destination")).toHaveTextContent(
      "/dashboardbusinessUnavailable",
    );
    expect(screen.queryByText("Venue page")).not.toBeInTheDocument();
  });

  it("moves the User back to Customer when eligibility is lost while in Business mode", async () => {
    signedInUser();
    mockModeStore.reset("business");
    mockVenues.data = [venue({ canEnterBusiness: false })];

    await renderWithI18n(
      <MemoryRouter initialEntries={["/business/507f1f77bcf86cd799439011"]}>
        <Routes>
          <Route path="/dashboard" element={<CustomerDestination />} />
          <Route
            path="/business/:businessId"
            element={
              <BusinessRouteShell>
                <div>Venue page</div>
              </BusinessRouteShell>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("customer-destination")).toHaveTextContent(
      "/dashboardbusinessUnavailable",
    );
    expect(screen.queryByText("Venue page")).not.toBeInTheDocument();
  });
});

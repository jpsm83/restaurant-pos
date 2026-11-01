import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IAuthAccessibleVenue } from "restaurant-pos-packages/interfaces/IAuth";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as i18nModule from "@/i18n/i18n";
import { ServiceRequestError } from "@/services/serviceErrors";
import { renderWithI18n } from "@/test/i18nTestUtils";
import Navbar from "../Navbar";

const {
  mockUseAuth,
  mockVenues,
  mockMode,
  mockSetAuthMode,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockVenues: {
    data: [] as IAuthAccessibleVenue[] | undefined,
    isLoading: false,
    isError: false,
  },
  mockMode: {
    data: undefined as "customer" | "business" | undefined,
  },
  mockSetAuthMode: vi.fn(),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/services/authVenues", () => ({
  useAccessibleVenuesQuery: () => mockVenues,
}));

vi.mock("@/services/authMode", () => ({
  useAuthModeQuery: () => mockMode,
  useSetAuthModeMutation: () => ({
    mutateAsync: mockSetAuthMode,
    isPending: false,
  }),
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function venue(
  overrides: Partial<IAuthAccessibleVenue> = {},
): IAuthAccessibleVenue {
  return {
    businessId: "b1",
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
      user: { id: "u1", email: "u@test.local", type: "user", role: "Customer" },
      status: "authenticated",
      error: null,
    },
    dispatch: vi.fn(),
  });
}

function renderNavbar(initialEntry = "/dashboard") {
  return renderWithI18n(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Routes>
        <Route
          path="/dashboard"
          element={
            <>
              <Navbar />
              <div>Dashboard page</div>
            </>
          }
        />
        <Route
          path="/business"
          element={
            <>
              <Navbar />
              <div>Business page</div>
            </>
          }
        />
        <Route
          path="/"
          element={
            <>
              <Navbar />
              <div>Customer page</div>
            </>
          }
        />
        <Route path="*" element={<Navbar />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Navbar", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockSetAuthMode.mockReset();
    mockSetAuthMode.mockResolvedValue(undefined);
    mockVenues.data = [];
    mockVenues.isLoading = false;
    mockVenues.isError = false;
    mockMode.data = undefined;
    mockUseAuth.mockReturnValue({
      state: {
        user: null,
        status: "unauthenticated",
        error: null,
      },
      dispatch: vi.fn(),
    });
  });

  it("renders the Business link on customer marketing home", async () => {
    const user = userEvent.setup();
    await renderNavbar("/");

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    const businessTab = screen.getByRole("link", { name: /business/i });
    await user.click(businessTab);
    expect(await screen.findByText("Business page")).toBeInTheDocument();
  });

  it("renders the User link on business marketing path", async () => {
    const user = userEvent.setup();
    await renderNavbar("/business");

    const userLink = screen.getByRole("link", { name: /switch to user/i });
    await user.click(userLink);
    expect(await screen.findByText("Customer page")).toBeInTheDocument();
  });

  it("links Sign in to the shared auth entry on the business audience", async () => {
    await renderNavbar("/business");

    const signIn = screen.getByRole("link", { name: /sign in/i });
    expect(signIn).toHaveAttribute("href", "/login");
  });

  it("links Sign up to the shared sign-up form on the business audience", async () => {
    await renderNavbar("/business");

    expect(screen.getByRole("link", { name: /sign up/i })).toHaveAttribute(
      "href",
      "/signup",
    );
  });

  it("hides the mode toggle for a pure customer with no accessible venues", async () => {
    signedInUser();
    mockVenues.data = [];

    await renderNavbar();

    expect(
      screen.queryByRole("group", { name: /workspace/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^business$/i }),
    ).not.toBeInTheDocument();
  });

  it("switches to Business and lands on the first enterable venue in list order", async () => {
    signedInUser();
    mockMode.data = "customer";
    mockVenues.data = [
      venue({ businessId: "blocked", canEnterBusiness: false }),
      venue({ businessId: "alpha", tradeName: "Alpha Bar" }),
      venue({ businessId: "beta", tradeName: "Beta Bar" }),
    ];
    const user = userEvent.setup();

    await renderNavbar();

    await user.click(screen.getByRole("button", { name: /^business$/i }));

    await waitFor(() => {
      expect(mockSetAuthMode).toHaveBeenCalledWith("business");
    });
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        /^\/business\/alpha\/dashboard$/,
      );
    });
  });

  it("keeps the venue already in the URL when switching to Business", async () => {
    signedInUser();
    mockMode.data = "customer";
    mockVenues.data = [
      venue({ businessId: "alpha", tradeName: "Alpha Bar" }),
      venue({ businessId: "beta", tradeName: "Beta Bar" }),
    ];
    const user = userEvent.setup();

    await renderNavbar("/business/beta/settings/profile");

    await user.click(screen.getByRole("button", { name: /^business$/i }));

    await waitFor(() => {
      expect(mockSetAuthMode).toHaveBeenCalledWith("business");
    });
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        /^\/business\/beta\/dashboard$/,
      );
    });
  });

  it("explains when venues exist but none are enterable and keeps /mode reachable", async () => {
    signedInUser();
    mockVenues.data = [
      venue({ businessId: "b1", canEnterBusiness: false }),
    ];

    await renderNavbar();

    expect(screen.getByRole("group", { name: /workspace/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^business$/i })).toBeDisabled();
    expect(
      screen.getByText(/business is not available for your venues/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see why/i })).toHaveAttribute(
      "href",
      "/mode",
    );
  });

  it("returns to Customer and lands on the customer dashboard", async () => {
    signedInUser();
    mockMode.data = "business";
    mockVenues.data = [venue()];
    const user = userEvent.setup();

    await renderNavbar("/business/b1/dashboard");

    await user.click(screen.getByRole("button", { name: /^customer$/i }));

    await waitFor(() => {
      expect(mockSetAuthMode).toHaveBeenCalledWith("customer");
    });
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(/^\/dashboard$/);
    });
  });

  it("renders localized copy when mode switching fails", async () => {
    signedInUser();
    mockMode.data = "customer";
    mockVenues.data = [venue()];
    mockSetAuthMode.mockRejectedValue(
      new ServiceRequestError({ code: "modeSave.forbidden", status: 403 }),
    );
    const user = userEvent.setup();

    await renderNavbar();

    await user.click(screen.getByRole("button", { name: /^business$/i }));

    expect(
      await screen.findByText(
        "Business mode is not allowed for this account right now.",
      ),
    ).toBeInTheDocument();
  });

  it("uses Spanish copy for the mode toggle", async () => {
    signedInUser();
    mockMode.data = "customer";
    mockVenues.data = [venue()];

    await renderWithI18n(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Navbar />
      </MemoryRouter>,
      { language: "es" },
    );

    expect(
      screen.getByRole("group", { name: /espacio de trabajo/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^cliente$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^empresa$/i }),
    ).toBeInTheDocument();
  });

  // Phase 2.3 — language popover calls persisted change helper.
  it("opens language popover and calls changeAppLanguage when a locale is chosen", async () => {
    const user = userEvent.setup();
    const spy = vi
      .spyOn(i18nModule, "changeAppLanguage")
      .mockResolvedValue(undefined);

    await renderNavbar("/");

    await user.click(
      screen.getByRole("button", { name: /change language/i }),
    );
    await user.click(
      await screen.findByRole("menuitemradio", { name: /^Español$/ }),
    );

    expect(spy).toHaveBeenCalledWith("es");
    spy.mockRestore();
  });
});

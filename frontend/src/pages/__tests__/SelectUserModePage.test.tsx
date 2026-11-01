import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IAuthAccessibleVenue } from "restaurant-pos-packages/interfaces/IAuth";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import { ServiceRequestError } from "@/services/serviceErrors";
import SelectUserModePage from "../SelectUserModePage";

const mockDispatch = vi.fn();
const mockSetModeAndRefresh = vi.fn();
const mockUseAuth = vi.fn();
const mockGetCurrentUser = vi.fn();
const {
  mockUseNextShiftForEmployee,
  mockUseAuthMode,
  mockVenues,
} = vi.hoisted(() => ({
  mockUseNextShiftForEmployee: vi.fn(),
  mockUseAuthMode: vi.fn(),
  mockVenues: {
    data: [] as IAuthAccessibleVenue[] | undefined,
    isLoading: false,
    isSuccess: true,
    isError: false,
    error: null as Error | null,
  },
}));

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/auth/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/auth/api")>();
  return {
    ...actual,
    getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
  };
});

vi.mock("@/context/AuthModeContext", () => ({
  useAuthMode: () => mockUseAuthMode(),
}));

vi.mock("@/services/authVenues", () => ({
  useAccessibleVenuesQuery: () => mockVenues,
}));

vi.mock("@/services/schedulesService", () => ({
  useNextShiftForEmployee: (...args: unknown[]) =>
    mockUseNextShiftForEmployee(...args),
}));

function makeEmployeeUser() {
  return {
    id: "u1",
    email: "staff@example.com",
    type: "user" as const,
    employeeId: "507f1f77bcf86cd799439011",
    businessId: "507f1f77bcf86cd799439012",
  };
}

function venue(
  overrides: Partial<IAuthAccessibleVenue> = {},
): IAuthAccessibleVenue {
  return {
    businessId: "507f1f77bcf86cd799439012",
    tradeName: "Alpha Bar",
    source: "membership",
    effectiveLayer: "employee",
    jobRoles: [],
    capabilities: [],
    canEnterBusiness: true,
    ...overrides,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

async function renderAtMode(path = "/mode", client?: QueryClient) {
  const qc =
    client ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: 0 },
      },
    });
  return renderWithI18n(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <Routes>
        <Route path="/mode" element={<SelectUserModePage />} />
        <Route
          path="/dashboard"
          element={<div data-testid="customer-shell">Customer shell</div>}
        />
        <Route
          path="/business/:businessId/dashboard"
          element={<div data-testid="business-shell">Business shell</div>}
        />
      </Routes>
    </MemoryRouter>,
    {
      wrapper: ({ children }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      ),
    },
  );
}

describe("SelectUserModePage (Phase 1.6)", () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockSetModeAndRefresh.mockReset();
    mockUseAuth.mockReset();
    mockGetCurrentUser.mockReset();
    mockUseNextShiftForEmployee.mockReset();
    mockUseAuthMode.mockReset();
    mockSetModeAndRefresh.mockResolvedValue(undefined);
    mockUseAuthMode.mockReturnValue({
      setModeAndRefresh: mockSetModeAndRefresh,
      isSettingMode: false,
      mode: "customer",
      isLoading: false,
      isError: false,
      error: null,
      refreshMode: vi.fn(),
    });
    mockUseNextShiftForEmployee.mockReturnValue({
      data: undefined,
      isSuccess: false,
      isLoading: false,
      isError: false,
      error: null,
    });
    mockGetCurrentUser.mockResolvedValue({ ok: true, data: null });
    mockVenues.data = [venue()];
    mockVenues.isLoading = false;
    mockVenues.isSuccess = true;
    mockVenues.isError = false;
    mockVenues.error = null;
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: makeEmployeeUser(),
        error: null,
      },
      dispatch: mockDispatch,
    });
  });

  it("sets Customer mode then navigates to the customer dashboard", async () => {
    const user = userEvent.setup();
    await renderAtMode();

    await user.click(screen.getByRole("button", { name: /continue as customer/i }));

    await waitFor(() => {
      expect(mockSetModeAndRefresh).toHaveBeenCalledWith("customer");
    });
    await waitFor(() => {
      expect(screen.getByTestId("customer-shell")).toBeInTheDocument();
    });
  });

  it("sets Business mode and opens the first enterable venue", async () => {
    mockVenues.data = [
      venue({
        businessId: "507f1f77bcf86cd799439099",
        tradeName: "Blocked Bar",
        canEnterBusiness: false,
      }),
      venue({ businessId: "alpha", tradeName: "Alpha Bar" }),
      venue({ businessId: "beta", tradeName: "Beta Bar" }),
    ];
    const user = userEvent.setup();
    await renderAtMode();

    await user.click(screen.getByRole("button", { name: /continue as business/i }));

    await waitFor(() => {
      expect(mockSetModeAndRefresh).toHaveBeenCalledWith("business");
    });
    await waitFor(() => {
      expect(screen.getByTestId("business-shell")).toBeInTheDocument();
    });
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/business/alpha/dashboard",
    );
  });

  it("explains a mode-switch failure in the active language", async () => {
    const user = userEvent.setup();
    mockSetModeAndRefresh.mockRejectedValueOnce(new Error("Network Error"));

    await renderAtMode();

    await user.click(
      screen.getByRole("button", { name: /continue as customer/i }),
    );

    expect(
      await screen.findByText(
        "We could not reach the server. Check your connection and try again.",
      ),
    ).toBeInTheDocument();
  });

  it("explains a mode-load failure in the active language", async () => {
    mockUseAuthMode.mockReturnValue({
      setModeAndRefresh: mockSetModeAndRefresh,
      isSettingMode: false,
      mode: undefined,
      isLoading: false,
      isError: true,
      error: new ServiceRequestError({
        code: "modeLoad.forbidden",
        status: 403,
      }),
      refreshMode: vi.fn(),
    });

    await renderAtMode();

    expect(
      screen.getByText("You do not have permission to do that."),
    ).toBeInTheDocument();
  });

  it("explains a schedule-load failure in the active language", async () => {
    mockVenues.data = [venue({ canEnterBusiness: false })];
    mockUseNextShiftForEmployee.mockReturnValue({
      data: undefined,
      isSuccess: false,
      isLoading: false,
      isError: true,
      error: new Error("Network Error"),
    });

    await renderAtMode();

    expect(
      screen.getByText(
        "We could not reach the server. Check your connection and try again.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps Business disabled and shows the schedule countdown when no venue is enterable yet", async () => {
    mockVenues.data = [venue({ canEnterBusiness: false })];
    mockUseNextShiftForEmployee.mockReturnValue({
      data: {
        entries: [
          {
            startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            vacation: false,
          },
        ],
      },
      isSuccess: true,
      isLoading: false,
      isError: false,
      error: null,
    });

    await renderAtMode();

    expect(
      screen.getByRole("button", { name: /continue as business/i }),
    ).toBeDisabled();
    expect(await screen.findByText(/unlocks in/i)).toBeInTheDocument();
    expect(
      screen.getByText(/your shift window opens soon/i),
    ).toBeInTheDocument();
  });

  it("redirects a User with no accessible venues to the customer dashboard", async () => {
    mockVenues.data = [];

    await renderAtMode();

    await waitFor(() => {
      expect(screen.getByTestId("customer-shell")).toBeInTheDocument();
    });
  });
});

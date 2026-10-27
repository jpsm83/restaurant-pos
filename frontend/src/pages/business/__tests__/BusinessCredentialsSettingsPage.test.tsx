import type { ReactElement } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import type { SupportedLanguage } from "@/i18n/config";
import type { BusinessProfileDto } from "@/services/business/businessService";
import BusinessCredentialsSettingsPage from "../BusinessCredentialsSettingsPage";

async function renderWithQueryClient(
  ui: ReactElement,
  language?: SupportedLanguage,
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: 0 },
    },
  });
  return renderWithI18n(ui, {
    ...(language ? { language } : {}),
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

const mockDispatch = vi.fn();
const mockUseBusinessProfileQuery = vi.fn();
const mockRequestPasswordReset = vi.fn();
const mockResendEmailConfirmation = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => ({
    state: {
      user: {
        id: "64b000000000000000000001",
        email: "owner@demo.test",
        type: "business",
        role: "Tenant",
      },
      status: "authenticated",
      error: null,
    },
    dispatch: mockDispatch,
  }),
}));

vi.mock("@/auth/api", () => ({
  requestPasswordReset: (...args: unknown[]) => mockRequestPasswordReset(...args),
  resendEmailConfirmation: (...args: unknown[]) =>
    mockResendEmailConfirmation(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock("@/services/business/businessService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/business/businessService")>();
  return {
    ...actual,
    useBusinessProfileQuery: (...args: unknown[]) =>
      mockUseBusinessProfileQuery(...args),
  };
});

function makeBusinessProfileDto(
  overrides: Partial<BusinessProfileDto> = {},
): BusinessProfileDto {
  return {
    _id: "64b000000000000000000001",
    imageUrl: "",
    tradeName: "Demo Bistro",
    legalName: "Demo Bistro LLC",
    email: "owner@demo.test",
    emailVerified: true,
    phoneNumber: "+10000000000",
    taxNumber: "TAX-001",
    subscription: "Free",
    currencyTrade: "USD",
    address: {
      country: "US",
      state: "CA",
      city: "San Diego",
      street: "Main St",
      buildingNumber: "10",
      doorNumber: "",
      complement: "",
      postCode: "92101",
      region: "",
    },
    contactPerson: "",
    cuisineType: [],
    categories: [],
    acceptsDelivery: false,
    metrics: {
      foodCostPercentage: 30,
      beverageCostPercentage: 20,
      laborCostPercentage: 30,
      fixedCostPercentage: 20,
      supplierGoodWastePercentage: {
        veryLowBudgetImpact: 9,
        lowBudgetImpact: 7,
        mediumBudgetImpact: 5,
        hightBudgetImpact: 3,
        veryHightBudgetImpact: 1,
      },
    },
    businessOpeningHours: [],
    deliveryOpeningWindows: [],
    reportingConfig: {},
    ...overrides,
  };
}

describe("BusinessCredentialsSettingsPage", () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockUseBusinessProfileQuery.mockReset();
    mockRequestPasswordReset.mockReset();
    mockResendEmailConfirmation.mockReset();
    mockToastSuccess.mockReset();
    mockToastError.mockReset();

    mockUseBusinessProfileQuery.mockReturnValue({
      data: makeBusinessProfileDto(),
      isLoading: false,
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    mockRequestPasswordReset.mockResolvedValue({
      ok: true,
      data: { message: "If an account exists, we sent instructions." },
    });
  });

  it("requests password reset email for session business email when button is clicked", async () => {
    const user = userEvent.setup();
    await renderWithQueryClient(
      <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/credentials"]}>
        <Routes>
          <Route
            path="/business/:businessId/settings/credentials"
            element={<BusinessCredentialsSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("button", {
      name: /email me a link to change password/i,
    });
    await user.click(
      screen.getByRole("button", { name: /email me a link to change password/i }),
    );

    await waitFor(() => {
      expect(mockRequestPasswordReset).toHaveBeenCalledWith("owner@demo.test");
    });
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "If an account exists for that address, we sent reset instructions.",
    );
  });

  it("uses local success copy for a resend confirmation", async () => {
    mockUseBusinessProfileQuery.mockReturnValue({
      data: makeBusinessProfileDto({ emailVerified: false }),
      isLoading: false,
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    mockResendEmailConfirmation.mockResolvedValue({
      ok: true,
      data: { message: "Server success copy" },
    });

    const user = userEvent.setup();
    await renderWithQueryClient(
      <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/credentials"]}>
        <Routes>
          <Route
            path="/business/:businessId/settings/credentials"
            element={<BusinessCredentialsSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", { name: /resend confirmation email/i }),
    );

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Confirmation email sent. Check your inbox.",
      );
    });
    expect(mockToastSuccess).not.toHaveBeenCalledWith("Server success copy");
  });

  it("treats an already-verified resend as success by machine code", async () => {
    mockUseBusinessProfileQuery.mockReturnValue({
      data: makeBusinessProfileDto({ emailVerified: false }),
      isLoading: false,
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    mockResendEmailConfirmation.mockResolvedValue({
      ok: false,
      error: {
        code: "resendConfirmation.badRequest",
        status: 400,
        serverMessage: "Your email is already verified.",
        fieldErrors: [],
      },
    });

    const user = userEvent.setup();
    await renderWithQueryClient(
      <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/credentials"]}>
        <Routes>
          <Route
            path="/business/:businessId/settings/credentials"
            element={<BusinessCredentialsSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", { name: /resend confirmation email/i }),
    );

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Your email is already verified.",
      );
    });
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("shows resend confirmation when email is not verified", async () => {
    mockUseBusinessProfileQuery.mockReturnValue({
      data: makeBusinessProfileDto({ emailVerified: false }),
      isLoading: false,
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    mockResendEmailConfirmation.mockResolvedValue({
      ok: true,
      data: { message: "Sent." },
    });

    const user = userEvent.setup();
    await renderWithQueryClient(
      <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/credentials"]}>
        <Routes>
          <Route
            path="/business/:businessId/settings/credentials"
            element={<BusinessCredentialsSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("button", { name: /resend confirmation email/i });
    await user.click(
      screen.getByRole("button", { name: /resend confirmation email/i }),
    );

    await waitFor(() => {
      expect(mockResendEmailConfirmation).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Confirmation email sent. Check your inbox.",
      );
    });
  });

  it("renders a reset-email failure in Spanish", async () => {
    mockRequestPasswordReset.mockResolvedValue({
      ok: false,
      error: {
        code: "passwordReset.transport",
        fieldErrors: [],
      },
    });

    const user = userEvent.setup();
    await renderWithQueryClient(
      <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/credentials"]}>
        <Routes>
          <Route
            path="/business/:businessId/settings/credentials"
            element={<BusinessCredentialsSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
      "es",
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Enviarme un enlace para cambiar la contraseña",
      }),
    );

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "No pudimos conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.",
      );
    });
  });
});

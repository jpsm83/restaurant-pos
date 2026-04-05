import type { ReactElement } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import type { BusinessProfileDto } from "@/services/business/businessService";
import BusinessCredentialsSettingsPage from "./BusinessCredentialsSettingsPage";

async function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: 0 },
    },
  });
  return renderWithI18n(ui, {
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
    reportingConfig: { weeklyReportStartDay: null },
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
    expect(mockToastSuccess).toHaveBeenCalled();
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
    });
  });
});
